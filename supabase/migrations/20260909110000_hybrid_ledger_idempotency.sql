alter table public.personal_transactions
  add column client_operation_id uuid;

create unique index personal_transactions_created_by_client_operation_id_idx
  on public.personal_transactions (created_by, client_operation_id)
  where client_operation_id is not null;

drop function public.record_personal_transaction(text, uuid, uuid, numeric, date, text, text, text, jsonb);

create function public.record_personal_transaction(
  p_operation_type text,
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_amount numeric,
  p_occurred_on date,
  p_category text,
  p_note text,
  p_merchant text,
  p_items jsonb default '[]'::jsonb,
  p_client_operation_id uuid default null
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

  if p_client_operation_id is not null then
    select id
      into v_transaction_id
    from public.personal_transactions
    where created_by = (select auth.uid())
      and client_operation_id = p_client_operation_id;

    if v_transaction_id is not null then
      return v_transaction_id;
    end if;
  end if;

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
    created_by,
    client_operation_id
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
    (select auth.uid()),
    p_client_operation_id
  )
  on conflict (created_by, client_operation_id) where client_operation_id is not null do nothing
  returning id into v_transaction_id;

  if v_transaction_id is null then
    select id
      into v_transaction_id
    from public.personal_transactions
    where created_by = (select auth.uid())
      and client_operation_id = p_client_operation_id;

    return v_transaction_id;
  end if;

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

revoke all on function public.record_personal_transaction(text, uuid, uuid, numeric, date, text, text, text, jsonb, uuid) from public;
grant execute on function public.record_personal_transaction(text, uuid, uuid, numeric, date, text, text, text, jsonb, uuid) to authenticated;

create function public.get_personal_ledger(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_personal_space_id uuid;
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
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

  return jsonb_build_object(
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', balances.id,
        'space_id', balances.space_id,
        'account_type', balances.account_type,
        'institution', balances.institution,
        'name', balances.name,
        'currency', balances.currency,
        'current_balance', balances.current_balance
      ) order by balances.name)
      from public.personal_account_balances balances
      where balances.space_id = v_personal_space_id
    ), '[]'::jsonb),
    'transactions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', transactions.id,
        'operation_type', transactions.operation_type,
        'source_account_id', transactions.source_account_id,
        'destination_account_id', transactions.destination_account_id,
        'amount', transactions.amount,
        'occurred_on', transactions.occurred_on,
        'category', transactions.category,
        'note', transactions.note,
        'merchant', transactions.merchant,
        'items', coalesce(items.items, '[]'::jsonb)
      ) order by transactions.occurred_on desc, transactions.id desc)
      from (
        select *
        from public.personal_transactions
        where personal_space_id = v_personal_space_id
        order by occurred_on desc, id desc
        limit v_limit
      ) transactions
      left join lateral (
        select jsonb_agg(jsonb_build_object(
          'id', purchase_items.id,
          'transaction_id', purchase_items.transaction_id,
          'description', purchase_items.description,
          'quantity', purchase_items.quantity,
          'unit_price', purchase_items.unit_price
        ) order by purchase_items.id) as items
        from public.purchase_items
        where purchase_items.transaction_id = transactions.id
      ) items on true
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_personal_ledger(integer) from public;
grant execute on function public.get_personal_ledger(integer) to authenticated;
