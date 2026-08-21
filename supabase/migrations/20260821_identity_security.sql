create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_email_not_blank check (length(trim(email)) > 0)
);

create table if not exists public.financial_spaces (
  id uuid primary key default extensions.gen_random_uuid(),
  kind text not null check (kind in ('personal', 'shared')),
  name text not null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint financial_spaces_created_by_kind_key unique (created_by, kind)
);

create table if not exists public.memberships (
  space_id uuid not null references public.financial_spaces (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (space_id, profile_id)
);

create index if not exists financial_spaces_created_by_idx
  on public.financial_spaces (created_by);

create index if not exists memberships_profile_id_idx
  on public.memberships (profile_id);

revoke all on public.profiles from anon, authenticated;
revoke all on public.financial_spaces from anon, authenticated;
revoke all on public.memberships from anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select on public.financial_spaces to authenticated;
grant select on public.memberships to authenticated;

alter table public.profiles enable row level security;
alter table public.financial_spaces enable row level security;
alter table public.memberships enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists financial_spaces_select_membership on public.financial_spaces;
create policy financial_spaces_select_membership
  on public.financial_spaces
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships
      where memberships.space_id = financial_spaces.id
        and memberships.profile_id = (select auth.uid())
    )
  );

drop policy if exists memberships_select_own on public.memberships;
create policy memberships_select_own
  on public.memberships
  for select
  to authenticated
  using (profile_id = (select auth.uid()));

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  personal_space_id uuid;
  profile_display_name text;
begin
  profile_display_name := nullif(
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'name'
    ),
    ''
  );

  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, profile_display_name)
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, public.profiles.display_name),
        updated_at = timezone('utc', now());

  insert into public.financial_spaces (kind, name, created_by)
  values ('personal', 'Mis finanzas', new.id)
  on conflict (created_by, kind) do update
    set name = excluded.name,
        updated_at = timezone('utc', now())
  returning id into personal_space_id;

  insert into public.memberships (space_id, profile_id, role)
  values (personal_space_id, new.id, 'owner')
  on conflict (space_id, profile_id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();
