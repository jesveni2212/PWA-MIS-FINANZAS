begin;

select plan(4);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'ana@example.com', '$2a$10$abcdefghijklmnopqrstuv', timezone('utc', now()), '{"provider":"email","providers":["email"]}', '{}', timezone('utc', now()), timezone('utc', now()), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', 'bruno@example.com', '$2a$10$abcdefghijklmnopqrstuv', timezone('utc', now()), '{"provider":"email","providers":["email"]}', '{}', timezone('utc', now()), timezone('utc', now()), '', '', '', '');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);

create temp table ana_movement as
with created_movement as (
  insert into public.movements (space_id, created_by, kind, amount, occurred_on, category, note)
  select id, '55555555-5555-4555-8555-555555555555'::uuid, 'expense', 12500.50, current_date, 'Supermercado', 'Compra semanal'
  from public.financial_spaces
  where created_by = '55555555-5555-4555-8555-555555555555'::uuid and kind = 'personal'
  returning *
)
select * from created_movement;

select is((select kind from ana_movement), 'expense', 'A member can create an expense');
select is((select amount from ana_movement), 12500.50::numeric, 'Amounts retain two-decimal precision');

select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
select is((select count(*)::int from public.movements where id = (select id from ana_movement)), 0, 'A non-member cannot read a movement');
select throws_ok(
  $$insert into public.movements (space_id, created_by, kind, amount, occurred_on, category)
    select space_id, '66666666-6666-4666-8666-666666666666'::uuid, 'expense', 1, current_date, 'Prueba' from ana_movement$$,
  '42501',
  null,
  'A non-member cannot create a movement in another space'
);

reset role;
select * from finish();
rollback;
