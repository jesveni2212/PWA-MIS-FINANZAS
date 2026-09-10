create table if not exists public.financial_reminders (
  id uuid primary key default extensions.gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category text,
  amount numeric(14, 2) check (amount is null or amount >= 0),
  currency text check (currency is null or currency in ('PYG', 'USD')),
  recurrence_type text not null check (recurrence_type in ('weekly', 'monthly', 'annual', 'custom')),
  recurrence_config jsonb not null,
  start_date date not null,
  next_due_on date not null,
  notify_days_before smallint not null default 1 check (notify_days_before between 0 and 30),
  timezone text not null default 'America/Asuncion',
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.financial_reminder_occurrences (
  id uuid primary key default extensions.gen_random_uuid(),
  reminder_id uuid not null references public.financial_reminders(id) on delete cascade,
  due_on date not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'omitted')),
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (reminder_id, due_on)
);

create table if not exists public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default false,
  in_app_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.push_subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notification_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  occurrence_id uuid not null references public.financial_reminder_occurrences(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  sent_at timestamptz not null default timezone('utc', now()),
  unique (occurrence_id, subscription_id)
);

create index if not exists financial_reminders_owner_active_due_idx
  on public.financial_reminders(created_by, active, next_due_on);
create index if not exists financial_reminder_occurrences_reminder_due_idx
  on public.financial_reminder_occurrences(reminder_id, due_on);
create index if not exists push_subscriptions_profile_enabled_idx
  on public.push_subscriptions(profile_id, enabled);

alter table public.financial_reminders enable row level security;
alter table public.financial_reminder_occurrences enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;

revoke all on public.financial_reminders from anon, authenticated;
revoke all on public.financial_reminder_occurrences from anon, authenticated;
revoke all on public.notification_preferences from anon, authenticated;
revoke all on public.push_subscriptions from anon, authenticated;
revoke all on public.notification_deliveries from anon, authenticated;
grant select on public.financial_reminders, public.financial_reminder_occurrences, public.notification_preferences to authenticated;

drop policy if exists financial_reminders_select_own on public.financial_reminders;
create policy financial_reminders_select_own on public.financial_reminders
  for select to authenticated using (created_by = (select auth.uid()));
drop policy if exists financial_reminders_insert_own on public.financial_reminders;
create policy financial_reminders_insert_own on public.financial_reminders
  for insert to authenticated with check (created_by = (select auth.uid()));
drop policy if exists financial_reminders_update_own on public.financial_reminders;
create policy financial_reminders_update_own on public.financial_reminders
  for update to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
drop policy if exists financial_reminders_delete_own on public.financial_reminders;
create policy financial_reminders_delete_own on public.financial_reminders
  for delete to authenticated using (created_by = (select auth.uid()));

drop policy if exists reminder_occurrences_select_own on public.financial_reminder_occurrences;
create policy reminder_occurrences_select_own on public.financial_reminder_occurrences
  for select to authenticated using (exists (
    select 1 from public.financial_reminders r
    where r.id = reminder_id and r.created_by = (select auth.uid())
  ));

drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated using (profile_id = (select auth.uid()));

create or replace function public.reminder_next_due_date(
  p_current date,
  p_recurrence_type text,
  p_recurrence_config jsonb
)
returns date
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_weekday integer;
  v_day integer;
  v_month integer;
  v_interval integer;
  v_unit text;
  v_target date;
  v_last_day integer;
  v_delta integer;
begin
  if p_current is null or p_recurrence_type is null or p_recurrence_config is null
    or jsonb_typeof(p_recurrence_config) <> 'object' then
    raise exception using errcode = '22023', message = 'Invalid reminder recurrence';
  end if;

  if p_recurrence_type = 'weekly' then
    if coalesce(p_recurrence_config ->> 'weekday', '') !~ '^[0-9]+$' then
      raise exception using errcode = '22023', message = 'Invalid weekly reminder recurrence';
    end if;
    v_weekday := (p_recurrence_config ->> 'weekday')::integer;
    if v_weekday not between 0 and 6 then
      raise exception using errcode = '22023', message = 'Invalid weekly reminder recurrence';
    end if;
    v_delta := (v_weekday - extract(dow from p_current)::integer + 7) % 7;
    if v_delta = 0 then v_delta := 7; end if;
    return p_current + v_delta;
  elsif p_recurrence_type = 'monthly' then
    if coalesce(p_recurrence_config ->> 'day', '') !~ '^[0-9]+$' then
      raise exception using errcode = '22023', message = 'Invalid monthly reminder recurrence';
    end if;
    v_day := (p_recurrence_config ->> 'day')::integer;
    if v_day not between 1 and 31 then
      raise exception using errcode = '22023', message = 'Invalid monthly reminder recurrence';
    end if;
    v_target := (date_trunc('month', p_current::timestamp) + interval '1 month')::date;
    v_last_day := extract(day from (v_target + interval '1 month - 1 day'))::integer;
    return v_target + (least(v_day, v_last_day) - 1);
  elsif p_recurrence_type = 'annual' then
    if coalesce(p_recurrence_config ->> 'month', '') !~ '^[0-9]+$'
      or coalesce(p_recurrence_config ->> 'day', '') !~ '^[0-9]+$' then
      raise exception using errcode = '22023', message = 'Invalid annual reminder recurrence';
    end if;
    v_month := (p_recurrence_config ->> 'month')::integer;
    v_day := (p_recurrence_config ->> 'day')::integer;
    if v_month not between 1 and 12 or v_day not between 1 and 31 then
      raise exception using errcode = '22023', message = 'Invalid annual reminder recurrence';
    end if;
    v_target := make_date(extract(year from p_current)::integer + 1, v_month, 1);
    v_last_day := extract(day from (v_target + interval '1 month - 1 day'))::integer;
    return v_target + (least(v_day, v_last_day) - 1);
  elsif p_recurrence_type = 'custom' then
    if coalesce(p_recurrence_config ->> 'interval', '') !~ '^[0-9]+$' then
      raise exception using errcode = '22023', message = 'Invalid custom reminder recurrence';
    end if;
    v_interval := (p_recurrence_config ->> 'interval')::integer;
    v_unit := p_recurrence_config ->> 'unit';
    if v_interval < 1 or v_unit not in ('days', 'weeks', 'months') then
      raise exception using errcode = '22023', message = 'Invalid custom reminder recurrence';
    end if;
    if v_unit = 'days' then return p_current + v_interval; end if;
    if v_unit = 'weeks' then return p_current + (v_interval * 7); end if;
    v_target := (date_trunc('month', p_current::timestamp) + make_interval(months => v_interval))::date;
    v_last_day := extract(day from (v_target + interval '1 month - 1 day'))::integer;
    return v_target + (least(extract(day from p_current)::integer, v_last_day) - 1);
  end if;

  raise exception using errcode = '22023', message = 'Invalid reminder recurrence type';
end;
$$;

revoke all on function public.reminder_next_due_date(date, text, jsonb) from public;

create or replace function public.create_personal_reminder(
  p_name text,
  p_category text,
  p_amount numeric,
  p_currency text,
  p_recurrence_type text,
  p_recurrence_config jsonb,
  p_start_date date,
  p_notify_days_before smallint,
  p_timezone text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_reminder_id uuid;
  v_due_on date;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Authentication is required'; end if;
  if nullif(trim(p_name), '') is null or p_start_date is null or p_recurrence_type not in ('weekly', 'monthly', 'annual', 'custom') then
    raise exception using errcode = '22023', message = 'Invalid personal reminder';
  end if;
  if p_amount is not null and p_amount < 0 then raise exception using errcode = '22023', message = 'Invalid reminder amount'; end if;
  if p_currency is not null and p_currency not in ('PYG', 'USD') then raise exception using errcode = '22023', message = 'Invalid reminder currency'; end if;
  if coalesce(p_notify_days_before, 1) not between 0 and 30 then raise exception using errcode = '22023', message = 'Invalid notification lead time'; end if;
  perform public.reminder_next_due_date(p_start_date, p_recurrence_type, p_recurrence_config);
  v_due_on := p_start_date;

  insert into public.financial_reminders(created_by, name, category, amount, currency, recurrence_type, recurrence_config, start_date, next_due_on, notify_days_before, timezone)
    values (v_user_id, trim(p_name), nullif(trim(p_category), ''), p_amount, p_currency, p_recurrence_type, p_recurrence_config, p_start_date, v_due_on, coalesce(p_notify_days_before, 1), coalesce(nullif(trim(p_timezone), ''), 'America/Asuncion'))
    returning id into v_reminder_id;
  insert into public.financial_reminder_occurrences(reminder_id, due_on) values (v_reminder_id, v_due_on);
  return v_reminder_id;
end;
$$;

create or replace function public.update_personal_reminder(
  p_reminder_id uuid,
  p_name text,
  p_category text,
  p_amount numeric,
  p_currency text,
  p_recurrence_type text,
  p_recurrence_config jsonb,
  p_start_date date,
  p_notify_days_before smallint,
  p_timezone text,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Authentication is required'; end if;
  if nullif(trim(p_name), '') is null or p_start_date is null or p_recurrence_type not in ('weekly', 'monthly', 'annual', 'custom') then
    raise exception using errcode = '22023', message = 'Invalid personal reminder';
  end if;
  if p_amount is not null and p_amount < 0 or p_currency is not null and p_currency not in ('PYG', 'USD') then
    raise exception using errcode = '22023', message = 'Invalid reminder amount or currency';
  end if;
  if coalesce(p_notify_days_before, 1) not between 0 and 30 then raise exception using errcode = '22023', message = 'Invalid notification lead time'; end if;
  perform public.reminder_next_due_date(p_start_date, p_recurrence_type, p_recurrence_config);
  update public.financial_reminders
    set name = trim(p_name), category = nullif(trim(p_category), ''), amount = p_amount, currency = p_currency,
        recurrence_type = p_recurrence_type, recurrence_config = p_recurrence_config, start_date = p_start_date,
        next_due_on = p_start_date, notify_days_before = coalesce(p_notify_days_before, 1),
        timezone = coalesce(nullif(trim(p_timezone), ''), 'America/Asuncion'), active = coalesce(p_active, true), updated_at = timezone('utc', now())
    where id = p_reminder_id and created_by = v_user_id;
  if not found then raise exception using errcode = '42501', message = 'Reminder ownership is required'; end if;
  update public.financial_reminder_occurrences set due_on = p_start_date
    where reminder_id = p_reminder_id and status = 'pending';
end;
$$;

create or replace function public.resolve_personal_reminder_occurrence(p_occurrence_id uuid, p_status text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_occurrence public.financial_reminder_occurrences;
  v_reminder public.financial_reminders;
  v_next_id uuid;
  v_next_date date;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Authentication is required'; end if;
  if p_status not in ('paid', 'omitted') then raise exception using errcode = '22023', message = 'Invalid occurrence status'; end if;
  select o, r into v_occurrence, v_reminder
    from public.financial_reminder_occurrences o
    join public.financial_reminders r on r.id = o.reminder_id
    where o.id = p_occurrence_id and r.created_by = v_user_id;
  if not found then raise exception using errcode = '42501', message = 'Occurrence ownership is required'; end if;
  if v_occurrence.status <> 'pending' then
    select id into v_next_id from public.financial_reminder_occurrences where reminder_id = v_reminder.id and status = 'pending' and due_on > v_occurrence.due_on order by due_on limit 1;
    if v_next_id is null and v_reminder.active then
      v_next_date := public.reminder_next_due_date(v_occurrence.due_on, v_reminder.recurrence_type, v_reminder.recurrence_config);
      insert into public.financial_reminder_occurrences(reminder_id, due_on) values (v_reminder.id, v_next_date) on conflict (reminder_id, due_on) do nothing;
      select id into v_next_id from public.financial_reminder_occurrences where reminder_id = v_reminder.id and due_on = v_next_date;
    end if;
    return v_next_id;
  end if;
  update public.financial_reminder_occurrences set status = p_status, resolved_at = timezone('utc', now()) where id = p_occurrence_id;
  if not v_reminder.active then return null; end if;
  v_next_date := public.reminder_next_due_date(v_occurrence.due_on, v_reminder.recurrence_type, v_reminder.recurrence_config);
  insert into public.financial_reminder_occurrences(reminder_id, due_on) values (v_reminder.id, v_next_date) on conflict (reminder_id, due_on) do nothing;
  update public.financial_reminders set next_due_on = v_next_date, updated_at = timezone('utc', now()) where id = v_reminder.id;
  select id into v_next_id from public.financial_reminder_occurrences where reminder_id = v_reminder.id and due_on = v_next_date;
  return v_next_id;
end;
$$;

create or replace function public.postpone_personal_reminder_occurrence(p_occurrence_id uuid, p_next_due_on date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reminder_id uuid;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Authentication is required'; end if;
  if p_next_due_on is null then raise exception using errcode = '22023', message = 'A due date is required'; end if;
  select o.reminder_id into v_reminder_id from public.financial_reminder_occurrences o join public.financial_reminders r on r.id = o.reminder_id where o.id = p_occurrence_id and o.status = 'pending' and r.created_by = auth.uid();
  if v_reminder_id is null then raise exception using errcode = '42501', message = 'Occurrence ownership is required'; end if;
  update public.financial_reminder_occurrences set due_on = p_next_due_on where id = p_occurrence_id;
  update public.financial_reminders set next_due_on = p_next_due_on, updated_at = timezone('utc', now()) where id = v_reminder_id;
end;
$$;

create or replace function public.set_notification_preferences(p_push_enabled boolean, p_in_app_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Authentication is required'; end if;
  insert into public.notification_preferences(profile_id, push_enabled, in_app_enabled)
    values (auth.uid(), coalesce(p_push_enabled, false), coalesce(p_in_app_enabled, true))
    on conflict (profile_id) do update set push_enabled = excluded.push_enabled, in_app_enabled = excluded.in_app_enabled, updated_at = timezone('utc', now());
end;
$$;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Authentication is required'; end if;
  if nullif(trim(p_endpoint), '') is null or nullif(trim(p_p256dh), '') is null or nullif(trim(p_auth), '') is null then raise exception using errcode = '22023', message = 'Invalid push subscription'; end if;
  select id into v_id from public.push_subscriptions where endpoint = trim(p_endpoint) and profile_id <> auth.uid();
  if v_id is not null then raise exception using errcode = '42501', message = 'Push subscription ownership is required'; end if;
  insert into public.push_subscriptions(profile_id, endpoint, p256dh, auth, user_agent, enabled, last_seen_at)
    values (auth.uid(), trim(p_endpoint), trim(p_p256dh), trim(p_auth), p_user_agent, true, timezone('utc', now()))
    on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent, enabled = true, last_seen_at = timezone('utc', now()), updated_at = timezone('utc', now())
    returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.disable_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Authentication is required'; end if;
  update public.push_subscriptions set enabled = false, updated_at = timezone('utc', now()) where endpoint = trim(p_endpoint) and profile_id = auth.uid();
end;
$$;

revoke all on function public.create_personal_reminder(text, text, numeric, text, text, jsonb, date, smallint, text) from public;
revoke all on function public.update_personal_reminder(uuid, text, text, numeric, text, text, jsonb, date, smallint, text, boolean) from public;
revoke all on function public.resolve_personal_reminder_occurrence(uuid, text) from public;
revoke all on function public.postpone_personal_reminder_occurrence(uuid, date) from public;
revoke all on function public.set_notification_preferences(boolean, boolean) from public;
revoke all on function public.save_push_subscription(text, text, text, text) from public;
revoke all on function public.disable_push_subscription(text) from public;
grant execute on function public.create_personal_reminder(text, text, numeric, text, text, jsonb, date, smallint, text) to authenticated;
grant execute on function public.update_personal_reminder(uuid, text, text, numeric, text, text, jsonb, date, smallint, text, boolean) to authenticated;
grant execute on function public.resolve_personal_reminder_occurrence(uuid, text) to authenticated;
grant execute on function public.postpone_personal_reminder_occurrence(uuid, date) to authenticated;
grant execute on function public.set_notification_preferences(boolean, boolean) to authenticated;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.disable_push_subscription(text) to authenticated;
