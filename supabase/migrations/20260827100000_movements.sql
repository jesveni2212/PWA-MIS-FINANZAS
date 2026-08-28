create table if not exists public.movements (
  id uuid primary key default extensions.gen_random_uuid(),
  space_id uuid not null references public.financial_spaces (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  amount numeric(14, 2) not null check (amount > 0),
  occurred_on date not null default current_date,
  category text not null check (length(trim(category)) > 0),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists movements_space_occurred_on_idx
  on public.movements (space_id, occurred_on desc);

revoke all on public.movements from anon, authenticated;
grant select, insert on public.movements to authenticated;

alter table public.movements enable row level security;

drop policy if exists movements_select_membership on public.movements;
create policy movements_select_membership
  on public.movements
  for select
  to authenticated
  using (
    exists (
      select 1 from public.memberships
      where memberships.space_id = movements.space_id
        and memberships.profile_id = (select auth.uid())
    )
  );

drop policy if exists movements_insert_membership on public.movements;
create policy movements_insert_membership
  on public.movements
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.memberships
      where memberships.space_id = movements.space_id
        and memberships.profile_id = (select auth.uid())
    )
  );
