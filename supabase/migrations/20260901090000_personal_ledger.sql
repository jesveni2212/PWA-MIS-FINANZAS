alter table public.accounts
  add column account_type text not null default 'bank'
    check (account_type in ('cash', 'bank', 'credit_card')),
  add column institution text not null default 'Otro',
  add column opening_debt numeric(14, 2) not null default 0
    check (opening_debt >= 0);

create table public.personal_transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  personal_space_id uuid not null references public.financial_spaces(id) on delete cascade,
  operation_type text not null check (operation_type in ('income', 'expense', 'card_purchase', 'transfer', 'card_payment')),
  source_account_id uuid references public.accounts(id),
  destination_account_id uuid references public.accounts(id),
  amount numeric(14, 2) not null check (amount > 0),
  occurred_on date not null,
  category text,
  note text,
  merchant text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.purchase_items (
  id uuid primary key default extensions.gen_random_uuid(),
  transaction_id uuid not null references public.personal_transactions(id) on delete cascade,
  description text not null check (length(trim(description)) > 0),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0)
);

revoke all on public.personal_transactions from anon, authenticated;
revoke all on public.purchase_items from anon, authenticated;
grant select on public.personal_transactions to authenticated;
grant select on public.purchase_items to authenticated;

alter table public.personal_transactions enable row level security;
alter table public.purchase_items enable row level security;

create policy personal_transactions_select_own_personal_space
  on public.personal_transactions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.financial_spaces
      join public.memberships
        on memberships.space_id = financial_spaces.id
      where financial_spaces.id = personal_transactions.personal_space_id
        and financial_spaces.kind = 'personal'
        and financial_spaces.created_by = (select auth.uid())
        and memberships.profile_id = (select auth.uid())
        and memberships.role = 'owner'
    )
  );

create policy purchase_items_select_own_personal_transaction
  on public.purchase_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.personal_transactions
      join public.financial_spaces
        on financial_spaces.id = personal_transactions.personal_space_id
      join public.memberships
        on memberships.space_id = financial_spaces.id
      where personal_transactions.id = purchase_items.transaction_id
        and financial_spaces.kind = 'personal'
        and financial_spaces.created_by = (select auth.uid())
        and memberships.profile_id = (select auth.uid())
        and memberships.role = 'owner'
    )
  );

create or replace function public.record_personal_transaction(
  p_operation_type text,
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_amount numeric,
  p_occurred_on date,
  p_category text,
  p_note text,
  p_merchant text,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_personal_space_id uuid;
  v_source_space_id uuid;
  v_destination_space_id uuid;
  v_source_account_type text;
  v_destination_account_type text;
  v_source_currency text;
  v_destination_currency text;
  v_transaction_id uuid;
  v_item jsonb;
  v_description text;
  v_quantity numeric;
  v_unit_price numeric;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  if p_operation_type is null
    or p_operation_type not in ('income', 'expense', 'card_purchase', 'transfer', 'card_payment')
    or p_amount is null
    or p_amount <= 0
    or p_occurred_on is null then
    raise exception using errcode = '22023', message = 'Invalid personal transaction';
  end if;

  select financial_spaces.id
    into v_personal_space_id
  from public.financial_spaces
  join public.memberships
    on memberships.space_id = financial_spaces.id
  where financial_spaces.kind = 'personal'
    and financial_spaces.created_by = (select auth.uid())
    and memberships.profile_id = (select auth.uid())
    and memberships.role = 'owner';

  if v_personal_space_id is null then
    raise exception using errcode = '42501', message = 'Personal space ownership is required';
  end if;

  if p_source_account_id is not null then
    select accounts.space_id, accounts.account_type, accounts.currency
      into v_source_space_id, v_source_account_type, v_source_currency
    from public.accounts
    join public.financial_spaces
      on financial_spaces.id = accounts.space_id
    join public.memberships
      on memberships.space_id = financial_spaces.id
    where accounts.id = p_source_account_id
      and financial_spaces.id = v_personal_space_id
      and financial_spaces.kind = 'personal'
      and financial_spaces.created_by = (select auth.uid())
      and memberships.profile_id = (select auth.uid())
      and memberships.role = 'owner';

    if v_source_space_id is null then
      raise exception using errcode = '42501', message = 'Source account ownership is required';
    end if;
  end if;

  if p_destination_account_id is not null then
    select accounts.space_id, accounts.account_type, accounts.currency
      into v_destination_space_id, v_destination_account_type, v_destination_currency
    from public.accounts
    join public.financial_spaces
      on financial_spaces.id = accounts.space_id
    join public.memberships
      on memberships.space_id = financial_spaces.id
    where accounts.id = p_destination_account_id
      and financial_spaces.id = v_personal_space_id
      and financial_spaces.kind = 'personal'
      and financial_spaces.created_by = (select auth.uid())
      and memberships.profile_id = (select auth.uid())
      and memberships.role = 'owner';

    if v_destination_space_id is null then
      raise exception using errcode = '42501', message = 'Destination account ownership is required';
    end if;
  end if;

  if (p_operation_type = 'income'
      and (p_source_account_id is not null or p_destination_account_id is null or v_destination_account_type = 'credit_card'))
    or (p_operation_type = 'expense'
      and (p_source_account_id is null or p_destination_account_id is not null or v_source_account_type = 'credit_card'))
    or (p_operation_type = 'card_purchase'
      and (p_source_account_id is null or p_destination_account_id is not null or v_source_account_type <> 'credit_card'))
    or (p_operation_type = 'transfer'
      and (p_source_account_id is null or p_destination_account_id is null or p_source_account_id = p_destination_account_id
        or v_source_account_type = 'credit_card' or v_destination_account_type = 'credit_card'
        or v_source_currency <> v_destination_currency))
    or (p_operation_type = 'card_payment'
      and (p_source_account_id is null or p_destination_account_id is null or p_source_account_id = p_destination_account_id
        or v_source_account_type = 'credit_card' or v_destination_account_type <> 'credit_card'
        or v_source_currency <> v_destination_currency)) then
    raise exception using errcode = '22023', message = 'Invalid account combination';
  end if;

  p_items := coalesce(p_items, '[]'::jsonb);

  if jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = '22023', message = 'Purchase items must be an array';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object'
      or jsonb_typeof(v_item -> 'description') <> 'string'
      or length(trim(v_item ->> 'description')) = 0
      or jsonb_typeof(v_item -> 'quantity') <> 'number'
      or jsonb_typeof(v_item -> 'unit_price') <> 'number' then
      raise exception using errcode = '22023', message = 'Invalid purchase item';
    end if;

    v_quantity := (v_item ->> 'quantity')::numeric;
    v_unit_price := (v_item ->> 'unit_price')::numeric;

    if v_quantity <= 0 or v_unit_price < 0 then
      raise exception using errcode = '22023', message = 'Invalid purchase item';
    end if;
  end loop;

  insert into public.personal_transactions (
    personal_space_id,
    operation_type,
    source_account_id,
    destination_account_id,
    amount,
    occurred_on,
    category,
    note,
    merchant,
    created_by
  )
  values (
    v_personal_space_id,
    p_operation_type,
    p_source_account_id,
    p_destination_account_id,
    p_amount,
    p_occurred_on,
    p_category,
    p_note,
    p_merchant,
    (select auth.uid())
  )
  returning id into v_transaction_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_description := trim(v_item ->> 'description');
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_unit_price := (v_item ->> 'unit_price')::numeric;

    insert into public.purchase_items (transaction_id, description, quantity, unit_price)
    values (v_transaction_id, v_description, v_quantity, v_unit_price);
  end loop;

  return v_transaction_id;
end;
$$;

revoke all on function public.record_personal_transaction(text, uuid, uuid, numeric, date, text, text, text, jsonb) from public;
grant execute on function public.record_personal_transaction(text, uuid, uuid, numeric, date, text, text, text, jsonb) to authenticated;

create view public.personal_account_balances with (security_invoker = true) as
select
  a.id,
  a.space_id,
  a.account_type,
  a.institution,
  a.name,
  a.currency,
  case when a.account_type = 'credit_card'
    then a.opening_debt
      + coalesce(sum(case when t.operation_type = 'card_purchase' and t.source_account_id = a.id then t.amount
                          when t.operation_type = 'card_payment' and t.destination_account_id = a.id then -t.amount
                          else 0 end), 0)
    else a.initial_balance
      + coalesce(sum(case when t.operation_type = 'income' and t.destination_account_id = a.id then t.amount
                          when t.operation_type in ('expense', 'transfer', 'card_payment') and t.source_account_id = a.id then -t.amount
                          when t.operation_type = 'transfer' and t.destination_account_id = a.id then t.amount
                          else 0 end), 0)
  end as current_balance
from public.accounts a
left join public.personal_transactions t on a.id in (t.source_account_id, t.destination_account_id)
join public.financial_spaces s on s.id = a.space_id and s.kind = 'personal'
group by a.id;

revoke all on public.personal_account_balances from anon, authenticated;
grant select on public.personal_account_balances to authenticated;
