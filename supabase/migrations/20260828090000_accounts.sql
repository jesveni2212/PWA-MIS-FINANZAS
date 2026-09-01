create table if not exists public.accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  space_id uuid not null references public.financial_spaces (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  currency text not null check (currency in ('PYG', 'USD')),
  initial_balance numeric(14, 2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (space_id, name)
);

revoke all on public.accounts from anon, authenticated;
grant select, insert on public.accounts to authenticated;

alter table public.accounts enable row level security;

create policy accounts_select_own_personal_space
  on public.accounts for select to authenticated
  using (
    exists (
      select 1 from public.financial_spaces
      where financial_spaces.id = accounts.space_id
        and financial_spaces.kind = 'personal'
        and financial_spaces.created_by = (select auth.uid())
    )
  );

create policy accounts_insert_own_personal_space
  on public.accounts for insert to authenticated
  with check (
    exists (
      select 1 from public.financial_spaces
      where financial_spaces.id = accounts.space_id
        and financial_spaces.kind = 'personal'
        and financial_spaces.created_by = (select auth.uid())
    )
  );
