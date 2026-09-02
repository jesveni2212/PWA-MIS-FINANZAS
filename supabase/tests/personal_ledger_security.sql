begin;

select plan(17);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '77777777-7777-4777-8777-777777777777', 'authenticated', 'authenticated', 'elena@example.com', '$2a$10$abcdefghijklmnopqrstuv', timezone('utc', now()), '{"provider":"email","providers":["email"]}', '{}', timezone('utc', now()), timezone('utc', now()), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '88888888-8888-4888-8888-888888888888', 'authenticated', 'authenticated', 'fabian@example.com', '$2a$10$abcdefghijklmnopqrstuv', timezone('utc', now()), '{"provider":"email","providers":["email"]}', '{}', timezone('utc', now()), timezone('utc', now()), '', '', '', '');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777777', true);

insert into public.accounts (id, space_id, name, currency, initial_balance, account_type, institution, opening_debt)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, id, 'Efectivo', 'PYG', 1000000, 'cash', 'Otro', 0
from public.financial_spaces
where created_by = '77777777-7777-4777-8777-777777777777'::uuid
  and kind = 'personal';

insert into public.accounts (id, space_id, name, currency, initial_balance, account_type, institution, opening_debt)
select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, id, 'Cuenta bancaria', 'PYG', 0, 'bank', 'Ueno', 0
from public.financial_spaces
where created_by = '77777777-7777-4777-8777-777777777777'::uuid
  and kind = 'personal';

insert into public.accounts (id, space_id, name, currency, initial_balance, account_type, institution, opening_debt)
select 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, id, 'Tarjeta', 'PYG', 0, 'credit_card', 'GNB', 0
from public.financial_spaces
where created_by = '77777777-7777-4777-8777-777777777777'::uuid
  and kind = 'personal';

select set_config('request.jwt.claim.sub', '88888888-8888-4888-8888-888888888888', true);

insert into public.accounts (id, space_id, name, currency, initial_balance, account_type, institution, opening_debt)
select 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid, id, 'Cuenta ajena', 'PYG', 0, 'cash', 'Otro', 0
from public.financial_spaces
where created_by = '88888888-8888-4888-8888-888888888888'::uuid
  and kind = 'personal';

select set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777777', true);

select lives_ok(
  $$select public.record_personal_transaction('expense', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, null, 50000, current_date, 'Comida', null, 'Biggie', '[]'::jsonb)$$,
  'an expense reduces the source available account'
);
select is(
  (select current_balance from public.personal_account_balances where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
  950000::numeric,
  'an expense only reduces the source available account'
);

select lives_ok(
  $$select public.record_personal_transaction('card_purchase', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, null, 150000, current_date, 'Comida', null, 'Biggie', '[]'::jsonb)$$,
  'a card purchase increases debt without reducing available cash'
);
select is(
  (select current_balance from public.personal_account_balances where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
  950000::numeric,
  'a card purchase does not reduce available cash'
);
select is(
  (select current_balance from public.personal_account_balances where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid),
  150000::numeric,
  'a card purchase increases credit-card debt'
);

select lives_ok(
  $$select public.record_personal_transaction('card_payment', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, 150000, current_date, 'Pago tarjeta', null, null, '[]'::jsonb)$$,
  'a card payment reduces available cash and credit-card debt once'
);
select is(
  (select current_balance from public.personal_account_balances where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
  800000::numeric,
  'a card payment reduces available cash once'
);
select is(
  (select current_balance from public.personal_account_balances where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid),
  0::numeric,
  'a card payment reduces credit-card debt once'
);

select lives_ok(
  $$select public.record_personal_transaction('income', null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 100000, current_date, 'Sueldo', null, null, '[]'::jsonb)$$,
  'an income increases the destination available account'
);
select is(
  (select current_balance from public.personal_account_balances where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
  900000::numeric,
  'an income only increases the destination available account'
);

select lives_ok(
  $$select public.record_personal_transaction('transfer', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 100000, current_date, null, null, null, '[]'::jsonb)$$,
  'a transfer moves available money between accounts'
);
select is(
  (select current_balance from public.personal_account_balances where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
  800000::numeric,
  'a transfer reduces the source account once'
);
select is(
  (select current_balance from public.personal_account_balances where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid),
  100000::numeric,
  'a transfer increases the destination account once'
);

select throws_ok(
  $$select public.record_personal_transaction('transfer', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid, 1, current_date, null, null, null, '[]'::jsonb)$$,
  '42501',
  null,
  'a user cannot reference another owner''s account'
);
select throws_ok(
  $$select public.record_personal_transaction('card_purchase', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, null, 1, current_date, null, null, null, '[]'::jsonb)$$,
  '22023',
  null,
  'invalid account combinations are rejected'
);
select throws_ok(
  $$select public.record_personal_transaction('expense', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, null, 1, current_date, null, null, null, '[{"description":"","quantity":1,"unit_price":1}]'::jsonb)$$,
  '22023',
  null,
  'invalid purchase items are rejected'
);
select is(
  (select count(*)::integer from public.personal_transactions),
  5,
  'a rejected item payload leaves no partial transaction'
);

reset role;
select * from finish();
rollback;
