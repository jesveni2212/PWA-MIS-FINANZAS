begin;
select no_plan();

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '10101010-1010-4010-8010-101010101010', 'authenticated', 'authenticated', 'benefit-owner@example.com', '$2a$10$abcdefghijklmnopqrstuv', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '20202020-2020-4020-8020-202020202020', 'authenticated', 'authenticated', 'benefit-foreign@example.com', '$2a$10$abcdefghijklmnopqrstuv', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into public.accounts (id, space_id, name, currency, account_type, institution)
select 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', id, 'Owner card', 'PYG', 'credit_card', 'Eko'
from public.financial_spaces where created_by = '10101010-1010-4010-8010-101010101010' and kind = 'personal';
insert into public.accounts (id, space_id, name, currency, account_type)
select 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', id, 'Foreign card', 'PYG', 'credit_card'
from public.financial_spaces where created_by = '20202020-2020-4020-8020-202020202020' and kind = 'personal';
insert into public.accounts (id, space_id, name, currency, account_type)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id, 'Cash', 'PYG', 'cash'
from public.financial_spaces where created_by = '10101010-1010-4010-8010-101010101010' and kind = 'personal';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10101010-1010-4010-8010-101010101010', true);

select lives_ok($$select public.create_personal_benefit(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, 'Biggie', ARRAY['Biggie Express'], ARRAY[2]::smallint[],
  '2026-09-01'::date, '2026-09-30'::date, 2000, 600000, 'PYG',
  'all', null, 'https://official.example/promo', 'draft'
)$$, 'the owner can create a draft benefit');
select is((select rebate_cap from public.personal_benefits where merchant_name = 'Biggie'), 120000::numeric,
  'the rebate cap is derived from rate and purchase cap');
select set_config('test.benefit_id', (select id::text from public.personal_benefits where merchant_name = 'Biggie'), true);
select is(jsonb_array_length(public.get_personal_benefits('2026-09-01') -> 'benefits'), 1, 'listing includes draft benefits');

select lives_ok($$select public.record_personal_transaction('card_purchase', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', null,
  85000, '2026-09-15', 'Comida', null, 'Biggie', '[]', null)$$, 'a draft does not block a purchase');
select is((select count(*)::integer from public.personal_benefit_applications), 0, 'draft rules do not apply');
select lives_ok($$select public.update_personal_benefit(current_setting('test.benefit_id')::uuid,
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Biggie', ARRAY['Biggie Express'], ARRAY[2,2]::smallint[],
  '2026-09-01', '2026-09-30', 2000, 600000, 'PYG', 'all', null, 'https://official.example/promo', 'active')$$,
  'the owner can activate and update a benefit');
select is((select weekdays from public.personal_benefits where id = current_setting('test.benefit_id')::uuid),
  ARRAY[2]::smallint[], 'weekdays are deduplicated for duplicate protection');

select lives_ok($$select public.record_personal_transaction(
  'card_purchase', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, null, 85000,
  '2026-09-15'::date, 'Comida', null, 'Biggie', '[{"description":"Food","quantity":1,"unit_price":85000}]'::jsonb,
  '11111111-1111-4111-8111-111111111111'::uuid)$$, 'a matching card purchase is accepted');
select is((select eligible_purchase_amount from public.personal_benefit_applications limit 1), 85000::numeric,
  'the application stores the eligible purchase amount');
select is((select estimated_rebate from public.personal_benefit_applications limit 1), 17000::numeric, 'the rebate is exact');
select is((select purchase_remaining from public.personal_benefit_applications limit 1), 515000::numeric, 'remaining purchase is stored');
select is((select rebate_remaining from public.personal_benefit_applications limit 1), 103000::numeric, 'remaining rebate is stored');
select is(public.record_personal_transaction('card_purchase', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', null,
  85000, '2026-09-15', 'Comida', null, 'Biggie', '[]', '11111111-1111-4111-8111-111111111111'),
  (select id from public.personal_transactions where client_operation_id = '11111111-1111-4111-8111-111111111111'),
  'retry returns the original transaction');
select is((select count(*)::integer from public.personal_benefit_applications), 1, 'retry does not insert another application');
select is((select count(*)::integer from public.purchase_items), 1, 'retry does not insert another purchase item');

select lives_ok($$select public.record_personal_transaction('card_purchase', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', null,
  10000, '2026-09-16', null, null, 'Biggie', '[]', null)$$, 'a Wednesday purchase is accepted');
select lives_ok($$select public.record_personal_transaction('card_purchase', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', null,
  10000, '2026-10-06', null, null, 'Biggie', '[]', null)$$, 'an out-of-window purchase is accepted');
select is((select count(*)::integer from public.personal_benefit_applications), 1, 'weekday and validity mismatches do not apply');
select lives_ok($$select public.record_personal_transaction('card_purchase', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', null,
  85000, '2026-09-22', null, null, '  BIGGIE,  EXPRESS! ', '[]', null)$$, 'normalized aliases match');
select is((select count(*)::integer from public.personal_benefit_applications), 2, 'alias matching creates an application');
select throws_ok($$select public.create_personal_benefit('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'BIGGIE', '{}', ARRAY[2]::smallint[],
  '2026-09-01', '2026-09-30', 2000, 600000, 'PYG', 'all', null, null, 'active')$$,
  '23505', null, 'an exact active duplicate is rejected');
select lives_ok($$select public.record_personal_transaction('card_purchase', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', null,
  500000, '2026-09-29', null, null, 'Biggie', '[]', null)$$, 'a purchase exceeding the cap is accepted');
select is((select sum(eligible_purchase_amount) from public.personal_benefit_applications), 600000::numeric, 'eligible purchase is clamped to the cap');
select is((select sum(estimated_rebate) from public.personal_benefit_applications), 120000::numeric, 'rebate is clamped to the cap');
select is((public.get_personal_benefits('2026-09-01') -> 'benefits' -> 0 ->> 'used_purchase')::numeric,
  600000::numeric, 'listing derives used purchase from applications');
select is((public.get_personal_benefits('2026-09-01') -> 'benefits' -> 0 ->> 'remaining_rebate')::numeric,
  0::numeric, 'listing returns remaining rebate');
select lives_ok($$select public.record_personal_transaction('card_purchase', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', null,
  100, '2026-09-29', null, null, 'Biggie', '[]', '22222222-2222-4222-8222-222222222222')$$,
  'an exhausted rule accepts a purchase');
select is((select eligible_purchase_amount from public.personal_benefit_applications a join public.personal_transactions t on t.id = a.transaction_id
  where t.client_operation_id = '22222222-2222-4222-8222-222222222222'), 0::numeric, 'exhausted caps consume no purchase');
select is(public.get_personal_benefits('2026-09-01') -> 'benefits' -> 0 ->> 'account_label', 'Eko · Owner card', 'listing includes account label');
select is(public.get_personal_benefits('2026-09-01') -> 'benefits' -> 0 ->> 'source_url', 'https://official.example/promo', 'listing includes source metadata');

select throws_ok($$insert into public.personal_benefits default values$$, '42501', null, 'direct benefit writes are revoked');
select throws_ok($$insert into public.personal_benefit_applications default values$$, '42501', null, 'direct application writes are revoked');
select throws_ok($$select public.create_personal_benefit('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Stock', '{}', ARRAY[2]::smallint[],
  '2026-09-01', '2026-09-30', 2000, 600000, 'PYG', 'all', null, null, 'active')$$, '42501', null, 'foreign accounts are rejected');
select throws_ok($$select public.create_personal_benefit('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Stock', '{}', ARRAY[2]::smallint[],
  '2026-09-01', '2026-09-30', 2000, 600000, 'PYG', 'all', null, null, 'active')$$, '22023', null, 'benefits require credit cards');
select throws_ok($$select public.create_personal_benefit('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Stock', '{}', ARRAY[7]::smallint[],
  '2026-09-01', '2026-09-30', 2000, 600000, 'PYG', 'all', null, null, 'active')$$, '22023', null, 'invalid weekdays are rejected');
select throws_ok($$select public.create_personal_benefit('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Stock', '{}', ARRAY[2]::smallint[],
  '2026-09-01', '2026-09-30', 2000, 600000, 'USD', 'all', null, null, 'active')$$, '22023', null, 'currency must match the card');

select set_config('request.jwt.claim.sub', '20202020-2020-4020-8020-202020202020', true);
select is(jsonb_array_length(public.get_personal_benefits('2026-09-01') -> 'benefits'), 0, 'a foreign user sees zero benefits via RPC');
select is((select count(*)::integer from public.personal_benefits), 0, 'RLS hides foreign benefits');
select is((select count(*)::integer from public.personal_benefit_applications), 0, 'RLS hides foreign applications');
select throws_ok($$select public.disable_personal_benefit(current_setting('test.benefit_id')::uuid)$$, '42501', null, 'foreign disable is rejected');
select throws_ok($$select public.duplicate_personal_benefit(current_setting('test.benefit_id')::uuid, '2026-10-01', '2026-10-31')$$,
  '42501', null, 'foreign duplication is rejected');
select throws_ok($$select public.update_personal_benefit(current_setting('test.benefit_id')::uuid,
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Biggie', '{}', ARRAY[2]::smallint[], '2026-09-01', '2026-09-30',
  2000, 600000, 'PYG', 'all', null, null, 'active')$$, '42501', null, 'foreign update is rejected');

select set_config('request.jwt.claim.sub', '10101010-1010-4010-8010-101010101010', true);
select lives_ok($$select public.duplicate_personal_benefit(current_setting('test.benefit_id')::uuid, '2026-10-01', '2026-10-31')$$,
  'the owner can duplicate to new dates');
select is((select status from public.personal_benefits where valid_from = '2026-10-01'), 'draft', 'duplicates start as draft');
select lives_ok($$select public.disable_personal_benefit(current_setting('test.benefit_id')::uuid)$$, 'the owner can disable');
select is(jsonb_array_length(public.get_personal_benefits('2026-09-01') -> 'benefits'), 0, 'disabled benefits are excluded from listing');
select lives_ok($$select public.create_personal_benefit('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Expired', '{}', ARRAY[2]::smallint[],
  '2026-09-01', '2026-09-30', 2000, 600000, 'PYG', 'all', null, null, 'expired')$$, 'expired benefits can be stored');
select lives_ok($$select public.record_personal_transaction('card_purchase', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', null,
  100, '2026-09-15', null, null, 'Expired', '[]', null)$$, 'expired promotions do not block purchases');
select is((select count(*)::integer from public.personal_benefit_applications), 4, 'expired promotions do not apply');
select is(jsonb_array_length(public.get_personal_benefits('2026-09-01') -> 'benefits'), 1, 'listing includes expired benefits');
select is(jsonb_array_length(public.get_personal_benefits('2026-10-15') -> 'benefits'), 1, 'listing filters the requested calendar month');

select lives_ok($$select public.create_personal_benefit('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'CAFÉ, Ñandú S.A.', '{}', ARRAY[2]::smallint[],
  '2026-09-01', '2026-09-30', 2500, 0.02, 'PYG', 'all', null, null, 'active')$$, 'fractional caps are accepted');
select is(public.normalize_benefit_merchant('  CAFÉ,  Ñandú S.A. '), 'cafe nandu sa', 'normalization matches the pure contract');
select is(public.normalize_benefit_merchant(U&'\6F22\5B57 \041C\0430\0433\0430\0437\0438\043D'),
  U&'\6F22\5B57 \043C\0430\0433\0430\0437\0438\043D', 'normalization retains Unicode letters independent of database locale');
select lives_ok($$select public.record_personal_transaction('card_purchase', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', null,
  0.02, '2026-09-15', null, null, 'Cafe Nandu SA', '[]', null)$$, 'accent and punctuation variants match');
select is((select estimated_rebate from public.personal_benefit_applications a join public.personal_benefits b on b.id = a.benefit_id
  where b.merchant_name = 'CAFÉ, Ñandú S.A.'), 0.01::numeric, 'rebate rounding uses decimal half-up');

select lives_ok($$select public.create_personal_benefit('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Rounding', '{}', ARRAY[2]::smallint[],
  '2026-09-01', '2026-09-30', 2000, 1, 'PYG', 'all', null, null, 'active')$$, 'a rebate-limited rule can be stored');
select lives_ok($$do $block$ begin
  for i in 1..19 loop
    perform public.record_personal_transaction('card_purchase', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', null,
      0.03, '2026-09-15', null, null, 'Rounding', '[]', null);
  end loop;
end $block$ $$, 'repeated fractional purchases retain exact money');
select lives_ok($$select public.record_personal_transaction('card_purchase', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', null,
  0.1, '2026-09-15', null, null, 'Rounding', '[]', '33333333-3333-4333-8333-333333333333')$$,
  'rebate-limited purchases are accepted');
select is((select eligible_purchase_amount from public.personal_benefit_applications a join public.personal_transactions t on t.id = a.transaction_id
  where t.client_operation_id = '33333333-3333-4333-8333-333333333333'), 0.07::numeric, 'eligibility clamps at the exact half-up boundary');
select is((select rebate_remaining from public.personal_benefit_applications a join public.personal_transactions t on t.id = a.transaction_id
  where t.client_operation_id = '33333333-3333-4333-8333-333333333333'), 0::numeric, 'rounding never exceeds the remaining rebate');
select lives_ok($$select public.update_personal_benefit((select id from public.personal_benefits where merchant_name = 'Rounding'),
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Rounding', '{}', ARRAY[2]::smallint[], '2026-09-22', '2026-09-30',
  2000, 1, 'PYG', 'all', null, null, 'active')$$, 'the owner can narrow the validity period');
select is((select (b ->> 'used_purchase')::numeric from jsonb_array_elements(public.get_personal_benefits('2026-09-01') -> 'benefits') b
  where b ->> 'merchant_name' = 'Rounding'), 0::numeric, 'listing excludes applications outside the current validity period');

select lives_ok($$select public.create_personal_benefit('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Ambiguous', '{}', ARRAY[2]::smallint[],
  '2026-09-01', '2026-09-30', 2000, 1000, 'PYG', 'all', null, null, 'active')$$, 'first ambiguous candidate can be stored');
select lives_ok($$select public.create_personal_benefit('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Ambiguous', '{}', ARRAY[2]::smallint[],
  '2026-09-01', '2026-09-30', 3000, 1000, 'PYG', 'all', null, null, 'active')$$, 'a distinct overlapping rule can be stored');
select lives_ok($$select public.record_personal_transaction('card_purchase', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', null,
  100, '2026-09-15', null, null, 'Ambiguous', '[]', null)$$, 'ambiguous matching returns a normal transaction');
select is((select count(*)::integer from public.personal_benefit_applications a join public.personal_benefits b on b.id = a.benefit_id
  where b.merchant_name = 'Ambiguous'), 0, 'ambiguous rules do not apply');

select set_config('request.jwt.claim.sub', '20202020-2020-4020-8020-202020202020', true);
select lives_ok($$select public.create_personal_benefit('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Biggie', ARRAY['Foreign-only alias'], ARRAY[2]::smallint[],
  '2026-09-01', '2026-09-30', 2000, 600000, 'PYG', 'all', null, null, 'active')$$,
  'another owner can independently configure the same merchant');
select set_config('request.jwt.claim.sub', '10101010-1010-4010-8010-101010101010', true);
select is((select merchant_aliases from public.personal_benefits where id = current_setting('test.benefit_id')::uuid),
  ARRAY['Biggie Express']::text[], 'foreign catalog additions do not change the owner rule aliases');
select lives_ok($$select public.create_personal_benefit('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Atomic', '{}', ARRAY[2]::smallint[],
  '2026-09-01', '2026-09-30', 2000, 1000, 'PYG', 'all', null, null, 'active')$$, 'an atomicity fixture is created');
reset role;
create function pg_temp.reject_test_benefit_application() returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.personal_transactions where id = new.transaction_id and merchant = 'Atomic') then
    raise exception using errcode = '23514', message = 'Test application failure';
  end if;
  return new;
end $$;
create trigger reject_test_benefit_application before insert on public.personal_benefit_applications
  for each row execute function pg_temp.reject_test_benefit_application();
set local role authenticated;
select throws_ok($$select public.record_personal_transaction('card_purchase', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', null,
  100, '2026-09-15', null, null, 'Atomic', '[{"description":"Atomic item","quantity":1,"unit_price":100}]',
  '44444444-4444-4444-8444-444444444444')$$, '23514', 'Test application failure', 'an application failure rejects the entire operation');
select is((select count(*)::integer from public.personal_transactions where client_operation_id = '44444444-4444-4444-8444-444444444444'),
  0, 'application failure rolls back the transaction');
select is((select count(*)::integer from public.purchase_items where description = 'Atomic item'), 0, 'application failure rolls back purchase items');

select throws_ok($$select public.require_personal_benefit_space()$$, '42501', null, 'private ownership helpers cannot be called directly');
select throws_ok($$select public.create_personal_benefit('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Invalid', '{}', ARRAY[2]::smallint[],
  '2026-09-01', '2026-09-30', 0, 100, 'PYG', 'all', null, null, 'active')$$, '22023', null, 'a zero rate is rejected');
select throws_ok($$select public.create_personal_benefit('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Invalid', '{}', ARRAY[2]::smallint[],
  '2026-09-30', '2026-09-01', 2000, 100, 'PYG', 'all', null, null, 'active')$$, '22023', null, 'inverted validity dates are rejected');
select throws_ok($$select public.create_personal_benefit('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Invalid', '{}', ARRAY[2]::smallint[],
  '2026-09-01', '2026-09-30', 2000, 'NaN'::numeric, 'PYG', 'all', null, null, 'active')$$, '22023', null, 'nonfinite purchase caps are rejected');

select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select public.get_personal_benefits('2026-09-01')$$, '42501', null, 'a missing identity is rejected');
reset role;
select ok(not has_function_privilege('anon', 'public.get_personal_benefits(date)', 'EXECUTE'), 'anonymous RPC execution is revoked');
select ok(not has_table_privilege('authenticated', 'public.benefit_merchant_aliases', 'INSERT'), 'catalog mutation is revoked');
select * from finish();
rollback;
