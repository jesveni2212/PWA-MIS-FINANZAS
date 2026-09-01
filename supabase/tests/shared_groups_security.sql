begin;

select plan(6);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'carla@example.com', '$2a$10$abcdefghijklmnopqrstuv', timezone('utc', now()), '{"provider":"email","providers":["email"]}', '{}', timezone('utc', now()), timezone('utc', now()), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'diego@example.com', '$2a$10$abcdefghijklmnopqrstuv', timezone('utc', now()), '{"provider":"email","providers":["email"]}', '{}', timezone('utc', now()), timezone('utc', now()), '', '', '', '');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

create temp table created_groups as
select * from public.create_shared_group('  Casa  ');

select is((select name from created_groups), 'Casa', 'The RPC trims the group name');
select is((select kind from created_groups), 'shared', 'The RPC creates a shared space');
select is((select created_by from created_groups), '33333333-3333-4333-8333-333333333333'::uuid, 'The authenticated user owns the space');
select is((select role from public.memberships where space_id = (select id from created_groups) and profile_id = '33333333-3333-4333-8333-333333333333'::uuid), 'owner', 'The creator receives an owner membership');

select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select is((select count(*)::int from public.financial_spaces where id = (select id from created_groups)), 0, 'A non-member cannot read the shared group');

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select lives_ok($$select public.create_shared_group('Vacaciones')$$, 'A creator can create more than one shared group');

reset role;
select * from finish();
rollback;
