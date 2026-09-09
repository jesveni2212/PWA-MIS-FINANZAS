begin;

select plan(5);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '10101010-1010-4010-8010-101010101010', 'authenticated', 'authenticated', 'ledger-owner@example.com', '$2a$10$abcdefghijklmnopqrstuv', timezone('utc', now()), '{"provider":"email","providers":["email"]}', '{}', timezone('utc', now()), timezone('utc', now()), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '20202020-2020-4020-8020-202020202020', 'authenticated', 'authenticated', 'ledger-foreign@example.com', '$2a$10$abcdefghijklmnopqrstuv', timezone('utc', now()), '{"provider":"email","providers":["email"]}', '{}', timezone('utc', now()), timezone('utc', now()), '', '', '', '');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10101010-1010-4010-8010-101010101010', true);

insert into public.accounts (id, space_id, name, currency, initial_balance, account_type, institution, opening_debt)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, id, 'Efectivo', 'PYG', 100, 'cash', 'Otro', 0
from public.financial_spaces
where created_by = '10101010-1010-4010-8010-101010101010'::uuid
  and kind = 'personal';

select lives_ok($$select public.get_personal_ledger(50)$$, 'authenticated users can read their ledger JSON');
select is(
  (select public.record_personal_transaction(
    'expense',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    null,
    25,
    '2026-09-09'::date,
    'Comida',
    null,
    null,
    '[]'::jsonb,
    '11111111-1111-4111-8111-111111111111'::uuid
  )),
  (select public.record_personal_transaction(
    'expense',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    null,
    25,
    '2026-09-09'::date,
    'Comida',
    null,
    null,
    '[]'::jsonb,
    '11111111-1111-4111-8111-111111111111'::uuid
  )),
  'retrying the same client operation returns the same transaction id'
);

select set_config(
  'test.first_transaction_id',
  (select id::text from public.personal_transactions),
  true
);

select set_config('request.jwt.claim.sub', '20202020-2020-4020-8020-202020202020', true);

insert into public.accounts (id, space_id, name, currency, initial_balance, account_type, institution, opening_debt)
select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, id, 'Efectivo ajeno', 'PYG', 100, 'cash', 'Otro', 0
from public.financial_spaces
where created_by = '20202020-2020-4020-8020-202020202020'::uuid
  and kind = 'personal';

select is(
  jsonb_array_length(public.get_personal_ledger(50) -> 'transactions'),
  0,
  'a second identity cannot see the first identity ledger JSON'
);

select isnt(
  public.record_personal_transaction(
    'expense',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    null,
    25,
    '2026-09-09'::date,
    'Comida',
    null,
    null,
    '[]'::jsonb,
    '11111111-1111-4111-8111-111111111111'::uuid
  ),
  current_setting('test.first_transaction_id')::uuid,
  'a second identity cannot reuse a first identity operation to access its transaction'
);

select is(
  jsonb_array_length(public.get_personal_ledger(50) -> 'transactions'),
  1,
  'the second identity sees only its own retried operation'
);

reset role;
select * from finish();
rollback;
