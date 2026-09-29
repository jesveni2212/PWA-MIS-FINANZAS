-- Merchant normalization mirrors src/lib/benefits/matching.ts. Money is numeric(14,2).
create function public.normalize_benefit_merchant(p_value text)
returns text language sql immutable strict
set search_path = public, pg_temp
as $$
  select trim(regexp_replace(
    regexp_replace(lower(regexp_replace(normalize(p_value, NFD) collate pg_c_utf8, U&'[\0300-\036f]', '', 'g')),
      '[^[:alnum:][:space:]]', '', 'g'), '[[:space:]]+', ' ', 'g'));
$$;
revoke all on function public.normalize_benefit_merchant(text) from public, anon;
grant execute on function public.normalize_benefit_merchant(text) to authenticated;

create table public.benefit_card_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  institution text not null check (length(trim(institution)) > 0),
  product_name text not null check (length(trim(product_name)) > 0),
  network text,
  active boolean not null default true,
  unique nulls not distinct (institution, product_name, network)
);
alter table public.accounts
  add column benefit_card_profile_id uuid references public.benefit_card_profiles(id);

create table public.benefit_merchants (
  id uuid primary key default extensions.gen_random_uuid(),
  canonical_name text not null,
  normalized_name text not null unique check (length(normalized_name) > 0),
  created_at timestamptz not null default timezone('utc', now()),
  check (normalized_name = public.normalize_benefit_merchant(canonical_name))
);
create table public.benefit_merchant_aliases (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.benefit_merchants(id) on delete cascade,
  alias text not null,
  normalized_alias text not null unique check (length(normalized_alias) > 0),
  check (normalized_alias = public.normalize_benefit_merchant(alias))
);
create index benefit_merchant_aliases_merchant_idx on public.benefit_merchant_aliases(merchant_id);

create table public.personal_benefits (
  id uuid primary key default extensions.gen_random_uuid(),
  personal_space_id uuid not null references public.financial_spaces(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  merchant_id uuid not null references public.benefit_merchants(id),
  merchant_name text not null,
  -- Each rule retains only the aliases its owner explicitly configured. A shared
  -- catalog insertion must never silently broaden another owner's matching rule.
  merchant_aliases text[] not null default '{}',
  rate_bps integer not null check (rate_bps > 0 and rate_bps <= 10000),
  purchase_cap numeric(14,2) not null check (purchase_cap > 0 and purchase_cap <> 'NaN'::numeric),
  rebate_cap numeric(14,2) not null,
  currency text not null check (currency in ('PYG', 'USD')),
  recurrence text not null default 'monthly' check (recurrence in ('monthly', 'weekly')),
  weekdays smallint[] not null check (cardinality(weekdays) > 0
    and array_ndims(weekdays) = 1 and array_position(weekdays, null) is null
    and weekdays <@ ARRAY[0,1,2,3,4,5,6]::smallint[]),
  valid_from date not null,
  valid_until date not null,
  channel text not null check (channel in ('all', 'physical', 'app', 'web')),
  conditions text,
  source_url text,
  source_checked_at timestamptz,
  status text not null check (status in ('draft', 'active', 'expired', 'disabled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (valid_until >= valid_from and isfinite(valid_from) and isfinite(valid_until)),
  check (rebate_cap = round(purchase_cap * rate_bps / 10000, 2))
);
create index personal_benefits_space_account_status_validity_idx
  on public.personal_benefits(personal_space_id, account_id, status, valid_from, valid_until);
-- RPCs canonicalize weekdays before this concurrency-safe duplicate guard.
create unique index personal_benefits_active_rule_idx
  on public.personal_benefits(account_id, merchant_id, valid_from, valid_until, rate_bps, purchase_cap, weekdays)
  where status = 'active';

create table public.personal_benefit_applications (
  id uuid primary key default extensions.gen_random_uuid(),
  personal_space_id uuid not null references public.financial_spaces(id) on delete cascade,
  transaction_id uuid not null unique references public.personal_transactions(id) on delete cascade,
  benefit_id uuid not null references public.personal_benefits(id) on delete restrict,
  eligible_purchase_amount numeric(14,2) not null check (eligible_purchase_amount >= 0 and eligible_purchase_amount <> 'NaN'::numeric),
  estimated_rebate numeric(14,2) not null check (estimated_rebate >= 0 and estimated_rebate <> 'NaN'::numeric),
  purchase_remaining numeric(14,2) not null check (purchase_remaining >= 0 and purchase_remaining <> 'NaN'::numeric),
  rebate_remaining numeric(14,2) not null check (rebate_remaining >= 0 and rebate_remaining <> 'NaN'::numeric),
  calculated_at timestamptz not null default timezone('utc', now())
);
-- The unique transaction_id constraint already supplies the required transaction index.
create index personal_benefit_applications_space_benefit_idx
  on public.personal_benefit_applications(personal_space_id, benefit_id);

revoke all on public.benefit_card_profiles, public.benefit_merchants, public.benefit_merchant_aliases,
  public.personal_benefits, public.personal_benefit_applications from public, anon, authenticated;
grant select on public.benefit_card_profiles, public.benefit_merchants, public.benefit_merchant_aliases,
  public.personal_benefits, public.personal_benefit_applications to authenticated;
alter table public.benefit_card_profiles enable row level security;
alter table public.benefit_merchants enable row level security;
alter table public.benefit_merchant_aliases enable row level security;
alter table public.personal_benefits enable row level security;
alter table public.personal_benefit_applications enable row level security;

create policy benefit_card_profiles_read_active on public.benefit_card_profiles
  for select to authenticated using (active and exists (
    select 1 from public.financial_spaces s join public.memberships m on m.space_id = s.id
    where s.kind = 'personal' and s.created_by = (select auth.uid())
      and m.profile_id = (select auth.uid()) and m.role = 'owner'
  ));
create policy personal_benefits_read_owner on public.personal_benefits
  for select to authenticated using (exists (
    select 1 from public.financial_spaces s
    join public.memberships m on m.space_id = s.id
    join public.accounts a on a.space_id = s.id
    where s.id = personal_benefits.personal_space_id and a.id = personal_benefits.account_id
      and s.kind = 'personal' and s.created_by = (select auth.uid())
      and m.profile_id = (select auth.uid()) and m.role = 'owner'
  ));
create policy personal_benefit_applications_read_owner on public.personal_benefit_applications
  for select to authenticated using (exists (
    select 1 from public.personal_benefits b
    join public.personal_transactions t on t.id = personal_benefit_applications.transaction_id
    where b.id = personal_benefit_applications.benefit_id
      and b.personal_space_id = personal_benefit_applications.personal_space_id
      and t.personal_space_id = b.personal_space_id
  ));
create policy benefit_merchants_read_owner_rules on public.benefit_merchants
  for select to authenticated using (exists (
    select 1 from public.personal_benefits b where b.merchant_id = benefit_merchants.id
  ));
create policy benefit_merchant_aliases_read_owner_rules on public.benefit_merchant_aliases
  for select to authenticated using (exists (
    select 1 from public.personal_benefits b
    where b.merchant_id = benefit_merchant_aliases.merchant_id
      and exists (select 1 from unnest(b.merchant_aliases) a
        where public.normalize_benefit_merchant(a) = benefit_merchant_aliases.normalized_alias)
  ));

-- Private shared authorization helper; no caller can invoke it through the API.
create function public.require_personal_benefit_space(p_account_id uuid default null)
returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_space_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  select s.id into v_space_id from public.financial_spaces s
  join public.memberships m on m.space_id = s.id
  where s.kind = 'personal' and s.created_by = (select auth.uid())
    and m.profile_id = (select auth.uid()) and m.role = 'owner';
  if v_space_id is null then
    raise exception using errcode = '42501', message = 'Personal space ownership is required';
  end if;
  if p_account_id is not null and not exists (
    select 1 from public.accounts where id = p_account_id and space_id = v_space_id
  ) then
    raise exception using errcode = '42501', message = 'Account ownership is required';
  end if;
  return v_space_id;
end;
$$;
revoke all on function public.require_personal_benefit_space(uuid) from public, anon, authenticated;

-- Create and update use one validation path. Catalog rows are append-only from RPCs.
create function public.save_personal_benefit(
  p_benefit_id uuid, p_account_id uuid, p_merchant_name text, p_aliases text[], p_weekdays smallint[],
  p_valid_from date, p_valid_until date, p_rate_bps integer, p_purchase_cap numeric,
  p_currency text, p_channel text, p_conditions text, p_source_url text, p_status text
)
returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_space_id uuid;
  v_merchant_id uuid;
  v_merchant_name text;
  v_normalized_name text;
  v_alias text;
  v_alias_merchant_id uuid;
  v_aliases text[];
  v_weekdays smallint[];
  v_purchase_cap numeric(14,2);
  v_currency text;
  v_account_type text;
  v_id uuid;
begin
  v_space_id := public.require_personal_benefit_space(p_account_id);
  if p_benefit_id is not null then
    perform 1 from public.personal_benefits b join public.accounts a on a.id = b.account_id
    where b.id = p_benefit_id and b.personal_space_id = v_space_id and a.space_id = v_space_id
    for update of b;
    if not found then
      raise exception using errcode = '42501', message = 'Benefit ownership is required';
    end if;
  end if;
  select currency, account_type into v_currency, v_account_type from public.accounts where id = p_account_id;
  v_normalized_name := public.normalize_benefit_merchant(p_merchant_name);
  if p_account_id is null or v_account_type <> 'credit_card'
    or v_normalized_name is null or v_normalized_name = ''
    or p_rate_bps is null or p_rate_bps not between 1 and 10000
    or p_purchase_cap is null or p_purchase_cap::text in ('NaN', 'Infinity', '-Infinity')
    or round(p_purchase_cap, 2) <= 0 or round(p_purchase_cap, 2) > 999999999999.99
    or p_currency is null or p_currency not in ('PYG', 'USD') or p_currency <> v_currency
    or p_channel is null or p_channel not in ('all', 'physical', 'app', 'web')
    or p_status is null or p_status not in ('draft', 'active', 'expired', 'disabled')
    or p_valid_from is null or p_valid_until is null or not isfinite(p_valid_from) or not isfinite(p_valid_until)
    or p_valid_until < p_valid_from
    or p_weekdays is null or cardinality(p_weekdays) = 0 or array_ndims(p_weekdays) <> 1
    or array_position(p_weekdays, null) is not null or not p_weekdays <@ ARRAY[0,1,2,3,4,5,6]::smallint[]
    or (p_aliases is not null and cardinality(p_aliases) > 0 and array_ndims(p_aliases) <> 1)
    or exists (select 1 from unnest(p_aliases) a where a is null or public.normalize_benefit_merchant(a) = '')
    or (nullif(trim(p_source_url), '') is not null and p_source_url !~ '^https?://[^[:space:]]+$') then
    raise exception using errcode = '22023', message = 'Invalid personal benefit';
  end if;
  v_purchase_cap := round(p_purchase_cap, 2);
  select array_agg(d order by d) into v_weekdays from (select distinct unnest(p_weekdays) d) days;
  select coalesce(array_agg(alias order by normalized), '{}'::text[]) into v_aliases from (
    select distinct on (public.normalize_benefit_merchant(a)) trim(a) alias, public.normalize_benefit_merchant(a) normalized
    from unnest(p_aliases) a
    where public.normalize_benefit_merchant(a) <> v_normalized_name
    order by public.normalize_benefit_merchant(a), trim(a)
  ) aliases;

  insert into public.benefit_merchants(canonical_name, normalized_name)
  values (trim(p_merchant_name), v_normalized_name)
  on conflict (normalized_name) do update set normalized_name = excluded.normalized_name
  returning id, canonical_name into v_merchant_id, v_merchant_name;
  if exists (select 1 from public.benefit_merchant_aliases
    where normalized_alias = v_normalized_name and merchant_id <> v_merchant_id) then
    raise exception using errcode = '22023', message = 'Merchant name conflicts with an existing alias';
  end if;
  foreach v_alias in array v_aliases loop
    if exists (select 1 from public.benefit_merchants
      where normalized_name = public.normalize_benefit_merchant(v_alias) and id <> v_merchant_id) then
      raise exception using errcode = '22023', message = 'Alias conflicts with an existing merchant';
    end if;
    insert into public.benefit_merchant_aliases(merchant_id, alias, normalized_alias)
    values (v_merchant_id, v_alias, public.normalize_benefit_merchant(v_alias))
    on conflict (normalized_alias) do update set normalized_alias = excluded.normalized_alias
    returning merchant_id into v_alias_merchant_id;
    if v_alias_merchant_id <> v_merchant_id then
      raise exception using errcode = '22023', message = 'Alias belongs to another merchant';
    end if;
  end loop;

  if p_benefit_id is null then
    insert into public.personal_benefits(personal_space_id, account_id, merchant_id, merchant_name, merchant_aliases,
      rate_bps, purchase_cap, rebate_cap, currency, weekdays, valid_from, valid_until, channel,
      conditions, source_url, source_checked_at, status)
    values (v_space_id, p_account_id, v_merchant_id, v_merchant_name, v_aliases,
      p_rate_bps, v_purchase_cap, round(v_purchase_cap * p_rate_bps / 10000, 2), p_currency, v_weekdays,
      p_valid_from, p_valid_until, p_channel, nullif(trim(p_conditions), ''), nullif(trim(p_source_url), ''),
      case when nullif(trim(p_source_url), '') is not null then timezone('utc', now()) end, p_status)
    returning id into v_id;
  else
    update public.personal_benefits set account_id = p_account_id, merchant_id = v_merchant_id,
      merchant_name = v_merchant_name, merchant_aliases = v_aliases, rate_bps = p_rate_bps,
      purchase_cap = v_purchase_cap, rebate_cap = round(v_purchase_cap * p_rate_bps / 10000, 2),
      currency = p_currency, weekdays = v_weekdays, valid_from = p_valid_from, valid_until = p_valid_until,
      channel = p_channel, conditions = nullif(trim(p_conditions), ''), source_url = nullif(trim(p_source_url), ''),
      source_checked_at = case when nullif(trim(p_source_url), '') is not null then timezone('utc', now()) end,
      status = p_status, updated_at = timezone('utc', now())
    where id = p_benefit_id returning id into v_id;
  end if;
  return v_id;
end;
$$;
revoke all on function public.save_personal_benefit(uuid, uuid, text, text[], smallint[], date, date, integer, numeric, text, text, text, text, text)
  from public, anon, authenticated;

create function public.create_personal_benefit(
  p_account_id uuid, p_merchant_name text, p_aliases text[], p_weekdays smallint[],
  p_valid_from date, p_valid_until date, p_rate_bps integer, p_purchase_cap numeric,
  p_currency text, p_channel text, p_conditions text, p_source_url text, p_status text default 'draft'
)
returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  return public.save_personal_benefit(null, p_account_id, p_merchant_name, p_aliases, p_weekdays,
    p_valid_from, p_valid_until, p_rate_bps, p_purchase_cap, p_currency, p_channel, p_conditions, p_source_url, p_status);
end;
$$;
create function public.update_personal_benefit(
  p_benefit_id uuid, p_account_id uuid, p_merchant_name text, p_aliases text[], p_weekdays smallint[],
  p_valid_from date, p_valid_until date, p_rate_bps integer, p_purchase_cap numeric,
  p_currency text, p_channel text, p_conditions text, p_source_url text, p_status text
)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_personal_benefit_space(p_account_id);
  if p_benefit_id is null then
    raise exception using errcode = '42501', message = 'Benefit ownership is required';
  end if;
  perform public.save_personal_benefit(p_benefit_id, p_account_id, p_merchant_name, p_aliases, p_weekdays,
    p_valid_from, p_valid_until, p_rate_bps, p_purchase_cap, p_currency, p_channel, p_conditions, p_source_url, p_status);
end;
$$;
create function public.duplicate_personal_benefit(p_benefit_id uuid, p_valid_from date, p_valid_until date)
returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_space_id uuid; v_benefit public.personal_benefits%rowtype; v_id uuid;
begin
  v_space_id := public.require_personal_benefit_space();
  select * into v_benefit from public.personal_benefits where id = p_benefit_id and personal_space_id = v_space_id;
  if not found then
    raise exception using errcode = '42501', message = 'Benefit ownership is required';
  end if;
  if v_benefit.recurrence <> 'monthly' then
    raise exception using errcode = '22023', message = 'Only monthly benefits can be duplicated';
  end if;
  v_id := public.create_personal_benefit(v_benefit.account_id, v_benefit.merchant_name, v_benefit.merchant_aliases,
    v_benefit.weekdays, p_valid_from, p_valid_until, v_benefit.rate_bps, v_benefit.purchase_cap,
    v_benefit.currency, v_benefit.channel, v_benefit.conditions, v_benefit.source_url, 'draft');
  update public.personal_benefits set source_checked_at = v_benefit.source_checked_at where id = v_id;
  return v_id;
end;
$$;
create function public.disable_personal_benefit(p_benefit_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_space_id uuid;
begin
  v_space_id := public.require_personal_benefit_space();
  update public.personal_benefits b set status = 'disabled', updated_at = timezone('utc', now())
  where b.id = p_benefit_id and b.personal_space_id = v_space_id
    and exists (select 1 from public.accounts a where a.id = b.account_id and a.space_id = v_space_id);
  if not found then
    raise exception using errcode = '42501', message = 'Benefit ownership is required';
  end if;
end;
$$;
create function public.get_personal_benefits(p_period_start date default date_trunc('month', current_date)::date)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_space_id uuid; v_month_start date; v_month_end date;
begin
  v_space_id := public.require_personal_benefit_space();
  if p_period_start is null or not isfinite(p_period_start) then
    raise exception using errcode = '22023', message = 'Invalid benefit period';
  end if;
  v_month_start := date_trunc('month', p_period_start)::date;
  v_month_end := (v_month_start + interval '1 month' - interval '1 day')::date;
  return jsonb_build_object('benefits', coalesce((
    select jsonb_agg(to_jsonb(b) || jsonb_build_object(
      'account_label', a.institution || ' · ' || a.name,
      'benefit_type', 'rebate', 'used_purchase', used.purchase, 'used_rebate', used.rebate,
      'remaining_purchase', greatest(0, b.purchase_cap - used.purchase),
      'remaining_rebate', greatest(0, b.rebate_cap - used.rebate)
    ) order by b.valid_from, b.merchant_name, b.id)
    from public.personal_benefits b join public.accounts a on a.id = b.account_id and a.space_id = v_space_id
    cross join lateral (
      select coalesce(sum(ap.eligible_purchase_amount), 0) purchase, coalesce(sum(ap.estimated_rebate), 0) rebate
      from public.personal_benefit_applications ap join public.personal_transactions t on t.id = ap.transaction_id
      where ap.benefit_id = b.id and ap.personal_space_id = v_space_id and t.personal_space_id = v_space_id
        and t.occurred_on between b.valid_from and b.valid_until
    ) used
    where b.personal_space_id = v_space_id and b.status in ('active', 'draft', 'expired')
      and b.valid_from <= v_month_end and b.valid_until >= v_month_start
  ), '[]'::jsonb));
end;
$$;

revoke all on function public.create_personal_benefit(uuid, text, text[], smallint[], date, date, integer, numeric, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.update_personal_benefit(uuid, uuid, text, text[], smallint[], date, date, integer, numeric, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.duplicate_personal_benefit(uuid, date, date) from public, anon, authenticated;
revoke all on function public.disable_personal_benefit(uuid) from public, anon, authenticated;
revoke all on function public.get_personal_benefits(date) from public, anon, authenticated;
grant execute on function public.create_personal_benefit(uuid, text, text[], smallint[], date, date, integer, numeric, text, text, text, text, text) to authenticated;
grant execute on function public.update_personal_benefit(uuid, uuid, text, text[], smallint[], date, date, integer, numeric, text, text, text, text, text) to authenticated;
grant execute on function public.duplicate_personal_benefit(uuid, date, date) to authenticated;
grant execute on function public.disable_personal_benefit(uuid) to authenticated;
grant execute on function public.get_personal_benefits(date) to authenticated;

-- Baseline: 20260909110000_hybrid_ledger_idempotency.sql. Existing validation,
-- insertion, conflict handling, item writes and return paths are unchanged.
drop function public.record_personal_transaction(text, uuid, uuid, numeric, date, text, text, text, jsonb, uuid);
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
  v_candidate public.personal_benefits%rowtype;
  v_benefit public.personal_benefits%rowtype;
  v_match_count integer := 0;
  v_used_purchase numeric;
  v_used_rebate numeric;
  v_purchase_remaining numeric;
  v_rebate_remaining numeric;
  v_eligible_purchase numeric;
  v_estimated_rebate numeric;
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

  -- Lock all candidates in stable order. More than one match is ambiguous,
  -- matching findMatchingBenefit's contract. This signature has no channel input,
  -- so it uses the pure matcher's optional-channel behavior (no channel filter).
  if p_operation_type = 'card_purchase' then
    for v_candidate in
      select b.* from public.personal_benefits b
      where b.personal_space_id = v_personal_space_id and b.account_id = p_source_account_id
        and b.status = 'active' and b.currency = v_source_currency
        and p_occurred_on between b.valid_from and b.valid_until
        and extract(dow from p_occurred_on)::smallint = any(b.weekdays)
        and (public.normalize_benefit_merchant(b.merchant_name) = public.normalize_benefit_merchant(p_merchant)
          or exists (select 1 from unnest(b.merchant_aliases) alias
            where public.normalize_benefit_merchant(alias) = public.normalize_benefit_merchant(p_merchant)))
      order by b.id for update of b
    loop
      v_benefit := v_candidate;
      v_match_count := v_match_count + 1;
    end loop;

    if v_match_count = 1 then
      -- A separate statement after the lock observes committed concurrent usage.
      select coalesce(sum(ap.eligible_purchase_amount), 0), coalesce(sum(ap.estimated_rebate), 0)
        into v_used_purchase, v_used_rebate
      from public.personal_benefit_applications ap join public.personal_transactions t on t.id = ap.transaction_id
      where ap.benefit_id = v_benefit.id and ap.personal_space_id = v_personal_space_id
        and t.personal_space_id = v_personal_space_id
        and t.occurred_on between v_benefit.valid_from and v_benefit.valid_until;
      v_purchase_remaining := greatest(0, v_benefit.purchase_cap - v_used_purchase);
      v_rebate_remaining := greatest(0, v_benefit.rebate_cap - v_used_rebate);
      -- Use the stored, quantized transaction amount and exact integer minor units.
      select least(amount, v_purchase_remaining) into v_eligible_purchase
      from public.personal_transactions where id = v_transaction_id;
      if v_rebate_remaining <= 0 then
        v_eligible_purchase := 0;
      else
        v_eligible_purchase := least(v_eligible_purchase,
          floor(((v_rebate_remaining * 100 * 2 + 1) * 10000 - 1) / (v_benefit.rate_bps * 2)) / 100);
      end if;
      v_estimated_rebate := round(v_eligible_purchase * v_benefit.rate_bps / 10000, 2);
      insert into public.personal_benefit_applications(personal_space_id, transaction_id, benefit_id,
        eligible_purchase_amount, estimated_rebate, purchase_remaining, rebate_remaining)
      values (v_personal_space_id, v_transaction_id, v_benefit.id, v_eligible_purchase, v_estimated_rebate,
        v_purchase_remaining - v_eligible_purchase, v_rebate_remaining - v_estimated_rebate);
    end if;
  end if;

  return v_transaction_id;
end;
$$;
revoke all on function public.record_personal_transaction(text, uuid, uuid, numeric, date, text, text, text, jsonb, uuid) from public, anon;
grant execute on function public.record_personal_transaction(text, uuid, uuid, numeric, date, text, text, text, jsonb, uuid) to authenticated;
