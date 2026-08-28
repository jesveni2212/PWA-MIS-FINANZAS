alter table public.financial_spaces
  drop constraint if exists financial_spaces_created_by_kind_key;

create unique index if not exists financial_spaces_one_personal_space_per_creator_idx
  on public.financial_spaces (created_by)
  where kind = 'personal';

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
  profile_display_name := nullif(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name'), '');

  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, profile_display_name)
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, public.profiles.display_name),
        updated_at = timezone('utc', now());

  insert into public.financial_spaces (kind, name, created_by)
  values ('personal', 'Mis finanzas', new.id)
  on conflict (created_by) where kind = 'personal' do update
    set name = excluded.name,
        updated_at = timezone('utc', now())
  returning id into personal_space_id;

  insert into public.memberships (space_id, profile_id, role)
  values (personal_space_id, new.id, 'owner')
  on conflict (space_id, profile_id) do nothing;

  return new;
end;
$$;

create or replace function public.create_shared_group(group_name text)
returns public.financial_spaces
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_profile_id uuid := auth.uid();
  created_group public.financial_spaces;
begin
  if current_profile_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if nullif(trim(group_name), '') is null then
    raise exception 'group name is required' using errcode = '22023';
  end if;

  insert into public.financial_spaces (kind, name, created_by)
  values ('shared', trim(group_name), current_profile_id)
  returning * into created_group;

  insert into public.memberships (space_id, profile_id, role)
  values (created_group.id, current_profile_id, 'owner');

  return created_group;
end;
$$;

revoke all on function public.create_shared_group(text) from public;
grant execute on function public.create_shared_group(text) to authenticated;
