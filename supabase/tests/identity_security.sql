begin;

select plan(11);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'alice@example.com',
    '$2a$10$abcdefghijklmnopqrstuv',
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Alice"}',
    timezone('utc', now()),
    timezone('utc', now()),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'bob@example.com',
    '$2a$10$zyxwvutsrqponmlkjihgfe',
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Bob"}',
    timezone('utc', now()),
    timezone('utc', now()),
    '',
    '',
    '',
    ''
  );

create temp table seeded_space_ids as
select id as alice_space_id
from public.financial_spaces
where created_by = '11111111-1111-4111-8111-111111111111';

select is(
  (
    select count(*)::int
    from public.profiles
    where id = '11111111-1111-4111-8111-111111111111'
  ),
  1,
  'Alice gets one profile'
);

select is(
  (
    select email
    from public.profiles
    where id = '11111111-1111-4111-8111-111111111111'
  ),
  'alice@example.com',
  'Alice profile keeps the auth email'
);

select is(
  (
    select count(*)::int
    from public.financial_spaces
    where created_by = '11111111-1111-4111-8111-111111111111'
      and kind = 'personal'
  ),
  1,
  'Alice gets one personal financial space'
);

select is(
  (
    select role::text
    from public.memberships
    where space_id = (select alice_space_id from seeded_space_ids)
      and profile_id = '11111111-1111-4111-8111-111111111111'
  ),
  'owner',
  'Alice gets one owner membership'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select is(
  (
    select count(*)::int
    from public.profiles
    where id = '11111111-1111-4111-8111-111111111111'
  ),
  1,
  'Alice can read her own profile through RLS'
);

select is(
  (
    select count(*)::int
    from public.financial_spaces
    where created_by = '11111111-1111-4111-8111-111111111111'
  ),
  1,
  'Alice can read her own space through RLS'
);

select is(
  (
    select count(*)::int
    from public.memberships
    where profile_id = '11111111-1111-4111-8111-111111111111'
  ),
  1,
  'Alice can read her own membership through RLS'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);

select is(
  (
    select count(*)::int
    from public.profiles
    where id = '11111111-1111-4111-8111-111111111111'
  ),
  0,
  'Bob cannot read Alice profile'
);

select is(
  (
    select count(*)::int
    from public.financial_spaces
    where created_by = '11111111-1111-4111-8111-111111111111'
  ),
  0,
  'Bob cannot read Alice space'
);

select is(
  (
    select count(*)::int
    from public.memberships
    where profile_id = '11111111-1111-4111-8111-111111111111'
  ),
  0,
  'Bob cannot read Alice membership'
);

create temp table membership_insert_errors(sqlstate text not null);

do $$
declare
  captured_sqlstate text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);

  begin
  insert into public.memberships (space_id, profile_id, role)
  values (
    (select alice_space_id from seeded_space_ids),
    '22222222-2222-4222-8222-222222222222',
    'member'
  );

    captured_sqlstate := 'NO_ERROR';
  exception
    when others then
      captured_sqlstate := sqlstate;
  end;

  reset role;

  insert into membership_insert_errors (sqlstate)
  values (captured_sqlstate);
end
$$;

select is(
  (select sqlstate from membership_insert_errors limit 1),
  '42501',
  'Authenticated clients cannot insert memberships directly'
);

reset role;

select * from finish();
rollback;
