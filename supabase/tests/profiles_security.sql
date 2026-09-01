begin;

select plan(2);

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
    '4c6f784a-12d6-4ee0-a745-8a17f44149d2',
    'authenticated',
    'authenticated',
    'profile-owner@example.com',
    '$2a$10$abcdefghijklmnopqrstuv',
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Profile Owner"}',
    timezone('utc', now()),
    timezone('utc', now()),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'c36e9f9d-8e7b-4841-946f-4ea25a729c6a',
    'authenticated',
    'authenticated',
    'profile-other@example.com',
    '$2a$10$zyxwvutsrqponmlkjihgfe',
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Profile Other"}',
    timezone('utc', now()),
    timezone('utc', now()),
    '',
    '',
    '',
    ''
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '4c6f784a-12d6-4ee0-a745-8a17f44149d2', true);

create temp table updated_profile as
update public.profiles
set display_name = 'Updated Profile Owner'
where id = '4c6f784a-12d6-4ee0-a745-8a17f44149d2'::uuid
returning display_name;

select is(
  (select display_name from updated_profile),
  'Updated Profile Owner',
  'An authenticated owner can update their display name'
);

select throws_ok(
  $$update public.profiles
    set email = 'changed@example.com'
    where id = '4c6f784a-12d6-4ee0-a745-8a17f44149d2'::uuid$$,
  '42501',
  null,
  'An authenticated owner cannot update their email'
);

reset role;

select * from finish();
rollback;
