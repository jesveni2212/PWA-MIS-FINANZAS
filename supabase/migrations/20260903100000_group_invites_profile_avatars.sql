alter table public.profiles
  add column if not exists avatar_path text;

create table if not exists public.group_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  group_id uuid not null references public.financial_spaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  use_count integer not null default 0 check (use_count >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists group_invites_group_id_idx on public.group_invites(group_id);
alter table public.group_invites enable row level security;
revoke all on public.group_invites from anon, authenticated;
grant select on public.group_invites to authenticated;

drop policy if exists group_invites_select_owner on public.group_invites;
create policy group_invites_select_owner on public.group_invites
  for select to authenticated
  using (created_by = (select auth.uid()));

revoke update on public.profiles from authenticated;
grant update (display_name, avatar_path) on public.profiles to authenticated;

create or replace function public.search_registered_profiles(search_text text)
returns table (id uuid, display_name text, avatar_path text, email_hint text)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or length(trim(search_text)) < 2 then
    return;
  end if;

  return query
    select p.id, coalesce(nullif(trim(p.display_name), ''), 'Usuario registrado'), p.avatar_path,
      case when position('@' in p.email) > 2 then left(p.email, 2) || '***' || substring(p.email from position('@' in p.email)) else 'correo protegido' end
    from public.profiles p
    where p.id <> auth.uid()
      and (p.display_name ilike '%' || trim(search_text) || '%' or p.email ilike '%' || trim(search_text) || '%')
    order by p.display_name nulls last, p.email
    limit 10;
end;
$$;

create or replace function public.create_group_invite(target_group_id uuid)
returns table (invite_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  raw_token text := encode(gen_random_bytes(32), 'hex');
  expiry timestamptz := timezone('utc', now()) + interval '7 days';
begin
  if auth.uid() is null or not exists (
    select 1 from public.memberships
    where space_id = target_group_id and profile_id = auth.uid() and role in ('owner', 'admin')
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.financial_spaces where id = target_group_id and kind = 'shared') then
    raise exception 'group not found' using errcode = '22023';
  end if;
  update public.group_invites set revoked_at = timezone('utc', now())
    where group_id = target_group_id and revoked_at is null;
  insert into public.group_invites(group_id, created_by, token_hash, expires_at)
    values (target_group_id, auth.uid(), encode(digest(raw_token, 'sha256'), 'hex'), expiry);
  return query select raw_token, expiry;
end;
$$;

create or replace function public.accept_group_invite(raw_token text)
returns table (group_id uuid, group_name text)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  invite public.group_invites;
  target public.financial_spaces;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into invite from public.group_invites
    where token_hash = encode(digest(trim(raw_token), 'sha256'), 'hex')
    for update;
  if not found or invite.revoked_at is not null or invite.expires_at <= timezone('utc', now()) then
    raise exception 'invitation unavailable' using errcode = '22023';
  end if;
  select * into target from public.financial_spaces where id = invite.group_id and kind = 'shared';
  if not found then raise exception 'invitation unavailable' using errcode = '22023'; end if;
  insert into public.memberships(space_id, profile_id, role)
    values (target.id, auth.uid(), 'member') on conflict (space_id, profile_id) do nothing;
  update public.group_invites set use_count = use_count + 1 where id = invite.id;
  return query select target.id, target.name;
end;
$$;

revoke all on function public.search_registered_profiles(text) from public;
grant execute on function public.search_registered_profiles(text) to authenticated;

create or replace function public.create_shared_group(group_name text, member_ids uuid[] default '{}')
returns public.financial_spaces
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_profile_id uuid := auth.uid();
  created_group public.financial_spaces;
begin
  if current_profile_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if nullif(trim(group_name), '') is null then raise exception 'group name is required' using errcode = '22023'; end if;
  insert into public.financial_spaces(kind, name, created_by)
    values ('shared', trim(group_name), current_profile_id) returning * into created_group;
  insert into public.memberships(space_id, profile_id, role)
    values (created_group.id, current_profile_id, 'owner');
  insert into public.memberships(space_id, profile_id, role)
    select created_group.id, p.id, 'member' from public.profiles p
    where p.id = any(coalesce(member_ids, '{}')) and p.id <> current_profile_id
    on conflict do nothing;
  return created_group;
end;
$$;

revoke all on function public.create_shared_group(text, uuid[]) from public;
grant execute on function public.create_shared_group(text, uuid[]) to authenticated;
revoke all on function public.create_group_invite(uuid) from public;
grant execute on function public.create_group_invite(uuid) to authenticated;

create or replace function public.revoke_group_invites(target_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (select 1 from public.memberships where space_id = target_group_id and profile_id = auth.uid() and role in ('owner', 'admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.group_invites set revoked_at = timezone('utc', now()) where group_id = target_group_id and revoked_at is null;
end;
$$;

revoke all on function public.revoke_group_invites(uuid) from public;
grant execute on function public.revoke_group_invites(uuid) to authenticated;
revoke all on function public.accept_group_invite(text) from public;
grant execute on function public.accept_group_invite(text) to authenticated;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

drop policy if exists avatars_select_authenticated on storage.objects;
create policy avatars_select_authenticated on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
