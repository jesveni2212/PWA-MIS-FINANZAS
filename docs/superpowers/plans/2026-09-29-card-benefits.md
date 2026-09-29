# Card Benefits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a configurable personal `Beneficios` area that applies monthly card promotions automatically to matching card purchases and reports separate purchase and rebate limits.

**Architecture:** Store promotions and immutable transaction applications in Supabase, with RLS and a server-authoritative RPC that evaluates benefits in the same transaction as a card purchase. Keep matching, normalization, cap calculations, and preview types in a standalone `src/lib/benefits` domain module; expose cached benefits through a dedicated provider used by the benefits page and movement form.

**Tech Stack:** Next.js 16.3.1 App Router, React 19, TypeScript, Supabase PostgreSQL/RLS/RPC, Tailwind CSS, IndexedDB offline storage, Vitest/Testing Library, Playwright, pgTAP SQL security tests.

## Global Constraints

- Promotions are manually configured in the first version; runtime scraping and bank APIs are out of scope.
- Benefit records, merchant aliases, source URLs, validity dates, and status live in the database; no bank, merchant, percentage, or amount may be hardcoded in UI or calculation code.
- The normal form derives `rebate_cap = purchase_cap × rate`; the user does not enter a separate rebate cap in the normal flow.
- Only `card_purchase` movements can consume a promotion. A card payment never consumes a promotion.
- The server is authoritative; client previews are projections and must never change account balances.
- A purchase can never consume the same promotion twice, including offline retries.
- All money calculations use exact integer/decimal-safe values compatible with the existing finance model; no binary floating-point result is persisted.
- All benefit and application reads/writes are restricted by the authenticated user’s personal `space_id` through RLS or security-definer ownership checks.
- Never store a full card number, CVV, bank password, external token, or other banking credential.
- The first version keeps estimated rebates informational; it does not increase account balance or net worth.
- Existing unrelated changes, including the pre-existing `next-env.d.ts` modification, must remain untouched.
- Before editing Next.js files, inspect the repository’s `AGENTS.md` instructions and read the relevant current guide under `node_modules/next/dist/docs/` when dependencies are available.

---

## File Map

### Create

- `supabase/migrations/20260929100000_card_benefits.sql` — benefit tables, constraints, RLS, CRUD RPCs, benefit listing RPC, and the idempotent transaction RPC extension.
- `supabase/tests/personal_benefits_security.sql` — pgTAP coverage for ownership, calculation, duplicate protection, and transaction application.
- `src/lib/benefits/types.ts` — benefit, application, draft, summary, and preview types.
- `src/lib/benefits/matching.ts` — pure merchant normalization, candidate matching, cap calculation, and preview logic.
- `src/lib/benefits/benefit-payload.ts` — runtime parser for Supabase benefit payloads.
- `src/lib/benefits/repository.ts` — browser Supabase RPC calls for loading and mutating personal benefits.
- `src/lib/benefits/server.ts` — server-side benefit loading for authenticated pages.
- `src/components/benefits/personal-benefits-provider.tsx` — benefits cache, refresh, CRUD actions, and client preview context.
- `src/components/benefits/benefits-content.tsx` — period selector, grouped benefit list, empty/error states, and add action.
- `src/components/benefits/benefit-form.tsx` — manual promotion form with account selector and derived rebate cap.
- `src/components/benefits/benefit-card.tsx` — single promotion card with two progress summaries.
- `src/app/beneficios/page.tsx` — authenticated benefits route.
- `tests/unit/benefits-matching.test.ts` — pure calculation and matching tests.
- `tests/unit/benefit-payload.test.ts` — malformed and valid payload parsing tests.
- `tests/unit/benefit-form.test.tsx` — form states and derived cap tests.
- `tests/unit/benefits-content.test.tsx` — list, empty, error, and duplication UI tests.
- `tests/e2e/benefits.spec.ts` — authenticated benefits workflow and automatic movement result.

### Modify

- `src/lib/site.ts` — add the `Beneficios` navigation item and icon.
- `src/components/app-shell.tsx` — keep the mobile navigation balanced after adding the seventh item.
- `src/components/movements/operation-form.tsx` — render automatic benefit calculation for matching card purchases without an approval step.
- `src/app/movimientos/page.tsx` — load and provide the active period’s benefits to the movement form.
- `src/lib/offline/storage.ts` — version and cache active benefits per user; clear them on sign-out.
- `tests/unit/operation-form.test.tsx` — automatic benefit result and no-confirmation behavior.
- `tests/unit/offline-storage.test.ts` — benefit cache isolation and cleanup.
- `tests/e2e/offline-finance.spec.ts` — cached benefit preview and server re-evaluation after sync.
- `README.md` — document manual promotion loading, derived caps, and the initial non-integrated source model.

---

### Task 1: Build the pure benefit domain

**Files:**
- Create: `src/lib/benefits/types.ts`
- Create: `src/lib/benefits/matching.ts`
- Test: `tests/unit/benefits-matching.test.ts`

**Interfaces:**
- Consumes: `PersonalAccount` and `PersonalTransaction` concepts from `src/lib/finance/types.ts`.
- Produces: `PersonalBenefit`, `PersonalBenefitDraft`, `BenefitSummary`, `BenefitMatchInput`, `BenefitPreview`, `normalizeMerchant`, `calculateRebateCap`, `findMatchingBenefit`, and `calculateBenefitPreview` for all later tasks.

- [ ] **Step 1: Write failing tests for cap derivation and partial consumption**

Create a test fixture with a 20% promotion and a ₲600.000 purchase cap. Cover the exact example and a purchase that exceeds the remaining cap:

```ts
const benefit: PersonalBenefit = {
  id: "benefit-1",
  accountId: "card-1",
  accountLabel: "Eko · Visa",
  merchantName: "Biggie",
  merchantAliases: ["Biggie Express"],
  benefitType: "rebate",
  rateBps: 2000,
  purchaseCap: 600000,
  rebateCap: 120000,
  usedPurchase: 300000,
  usedRebate: 60000,
  currency: "PYG",
  recurrence: "monthly",
  weekdays: [2],
  validFrom: "2026-09-01",
  validUntil: "2026-09-30",
  channel: "all",
  conditions: null,
  sourceUrl: null,
  sourceCheckedAt: null,
  status: "active",
};

it("derives the 20 percent rebate cap and remaining amounts", () => {
  expect(calculateRebateCap(600000, 2000)).toBe(120000);
  expect(calculateBenefitPreview(benefit, { amount: 85000, occurredOn: "2026-09-15" })).toMatchObject({
    eligiblePurchase: 85000,
    estimatedRebate: 17000,
    purchaseRemaining: 215000,
    rebateRemaining: 43000,
  });
});

it("does not consume more than either remaining cap", () => {
  expect(calculateBenefitPreview({ ...benefit, usedPurchase: 580000, usedRebate: 116000 }, { amount: 50000, occurredOn: "2026-09-22" })).toMatchObject({
    eligiblePurchase: 20000,
    estimatedRebate: 4000,
    purchaseRemaining: 0,
    rebateRemaining: 0,
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `corepack pnpm exec vitest run tests/unit/benefits-matching.test.ts`

Expected: FAIL because the benefits domain module and exported functions do not exist yet.

- [ ] **Step 3: Define the benefit types**

Create exact types for `BenefitStatus = "draft" | "active" | "expired" | "disabled"`, `BenefitType = "rebate"`, `BenefitRecurrence = "monthly" | "weekly"`, `BenefitChannel = "all" | "physical" | "app" | "web"`, plus the persisted benefit, draft, summary, match input, and preview objects. Store percentages as `rateBps` (`2000` means 20%) and amounts as numbers matching the existing money boundary; convert to exact SQL numeric values at the repository/RPC boundary.

- [ ] **Step 4: Implement normalization, matching, and calculation**

Implement these pure functions without React or Supabase calls:

```ts
export function normalizeMerchant(value: string): string;
export function calculateRebateCap(purchaseCap: number, rateBps: number): number;
export function findMatchingBenefit(benefits: PersonalBenefit[], input: BenefitMatchInput): PersonalBenefit | null;
export function calculateBenefitPreview(benefit: PersonalBenefit, input: Pick<BenefitMatchInput, "amount" | "occurredOn">): BenefitPreview;
```

`normalizeMerchant` lowercases, trims, collapses whitespace, removes punctuation, and maps Spanish accented characters to their ASCII equivalents. Matching must require the exact account ID, active status, valid date, weekday, currency, and canonical/alias merchant match. `calculateBenefitPreview` must clamp eligible purchase to the remaining purchase cap and estimated rebate to the remaining rebate cap.

- [ ] **Step 5: Add tests for merchant aliases and date filters**

Cover `"BIGGIE EXPRESS"` matching the configured alias, a non-matching merchant, a Wednesday purchase against a Tuesday rule, an expired rule, a draft rule, and an amount with no remaining cap. Assert `findMatchingBenefit` returns `null` rather than selecting a second rule when equally specific active candidates exist.

- [ ] **Step 6: Run the focused test and commit**

Run: `corepack pnpm exec vitest run tests/unit/benefits-matching.test.ts`

Expected: PASS with all calculation and matching cases. Commit:

```bash
git add src/lib/benefits/types.ts src/lib/benefits/matching.ts tests/unit/benefits-matching.test.ts
git commit -m "feat: add card benefit matching domain"
```

---

### Task 2: Add Supabase storage, RPCs, and security tests

**Files:**
- Create: `supabase/migrations/20260929100000_card_benefits.sql`
- Create: `supabase/tests/personal_benefits_security.sql`

**Interfaces:**
- Consumes: `PersonalAccount`, `personal_transactions`, and the idempotent `record_personal_transaction(text, uuid, uuid, numeric, date, text, text, text, jsonb, uuid)` function created by `20260909110000_hybrid_ledger_idempotency.sql`.
- Produces: tables `benefit_card_profiles`, `benefit_merchants`, `benefit_merchant_aliases`, `personal_benefits`, `personal_benefit_applications`; RPCs `get_personal_benefits`, `create_personal_benefit`, `update_personal_benefit`, `duplicate_personal_benefit`, `disable_personal_benefit`; and the extended idempotent transaction RPC that inserts one application atomically.

- [ ] **Step 1: Write the pgTAP security test fixture**

Create two authenticated users and personal spaces, then assert:

```sql
select lives_ok($$select public.create_personal_benefit(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, 'Biggie', ARRAY['Biggie Express'], ARRAY[2],
  '2026-09-01'::date, '2026-09-30'::date, 2000, 600000, 'PYG',
  'all', null, 'https://official.example/promo', 'draft'
)$$, 'the owner can create a draft benefit');

select is(
  (select rebate_cap from public.personal_benefits where merchant_name = 'Biggie'),
  120000::numeric,
  'the rebate cap is derived from rate and purchase cap'
);

select lives_ok($$select public.record_personal_transaction(
  'card_purchase', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, null, 85000,
  '2026-09-15'::date, 'Comida', null, 'Biggie', '[]'::jsonb,
  '11111111-1111-4111-8111-111111111111'::uuid
)$$, 'a matching card purchase is accepted');

select is(
  (select eligible_purchase_amount from public.personal_benefit_applications limit 1),
  85000::numeric,
  'the application stores the eligible purchase amount'
);
```

Also cover a foreign user seeing zero benefits, a foreign account being rejected, a draft/expired rule not applying, a Wednesday purchase not applying to a Tuesday rule, an alias matching, a duplicate active rule being rejected, and a repeated client operation returning the same transaction without a second application.

- [ ] **Step 2: Run the new SQL test before implementing the migration**

Run: `corepack pnpm exec supabase test db supabase/tests/personal_benefits_security.sql`

Expected: FAIL because the benefit tables and functions do not exist.

- [ ] **Step 3: Create tables and constraints**

In the migration, create:

```sql
create table public.benefit_card_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  institution text not null,
  product_name text not null,
  network text,
  active boolean not null default true,
  unique (institution, product_name, network)
);

alter table public.accounts
  add column benefit_card_profile_id uuid references public.benefit_card_profiles(id);

create table public.benefit_merchants (
  id uuid primary key default extensions.gen_random_uuid(),
  canonical_name text not null,
  normalized_name text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.benefit_merchant_aliases (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.benefit_merchants(id) on delete cascade,
  alias text not null,
  normalized_alias text not null unique
);

create table public.personal_benefits (
  id uuid primary key default extensions.gen_random_uuid(),
  personal_space_id uuid not null references public.financial_spaces(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  merchant_id uuid not null references public.benefit_merchants(id),
  rate_bps integer not null check (rate_bps > 0 and rate_bps <= 10000),
  purchase_cap numeric(14,2) not null check (purchase_cap > 0),
  rebate_cap numeric(14,2) not null,
  currency text not null check (currency in ('PYG', 'USD')),
  recurrence text not null check (recurrence in ('monthly', 'weekly')),
  weekdays smallint[] not null check (cardinality(weekdays) > 0),
  valid_from date not null,
  valid_until date not null,
  channel text not null check (channel in ('all', 'physical', 'app', 'web')),
  conditions text,
  source_url text,
  source_checked_at timestamptz,
  status text not null check (status in ('draft', 'active', 'expired', 'disabled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (valid_until >= valid_from),
  check (rebate_cap = round(purchase_cap * rate_bps / 10000, 2))
);

create table public.personal_benefit_applications (
  id uuid primary key default extensions.gen_random_uuid(),
  personal_space_id uuid not null references public.financial_spaces(id) on delete cascade,
  transaction_id uuid not null unique references public.personal_transactions(id) on delete cascade,
  benefit_id uuid not null references public.personal_benefits(id) on delete restrict,
  eligible_purchase_amount numeric(14,2) not null check (eligible_purchase_amount >= 0),
  estimated_rebate numeric(14,2) not null check (estimated_rebate >= 0),
  purchase_remaining numeric(14,2) not null check (purchase_remaining >= 0),
  rebate_remaining numeric(14,2) not null check (rebate_remaining >= 0),
  calculated_at timestamptz not null default timezone('utc', now())
);
```

Use a normalized merchant/alias representation so the RPC can match transaction text without knowing bank-specific strings. Add indexes for `(personal_space_id, account_id, status, valid_from, valid_until)`, `(transaction_id)`, and merchant normalized values. Add a duplicate-protection constraint or an RPC check covering the exact account, merchant, validity, rate, cap, weekday array, and active status.

- [ ] **Step 4: Add RLS, grants, and ownership checks**

Revoke direct anonymous/authenticated table access where existing finance tables use security-definer RPCs. Enable RLS and add owner-only policies matching the personal ledger’s `financial_spaces.kind = 'personal'`, `created_by = auth.uid()`, membership, and owner checks. Every security-definer function must set `search_path = public, pg_temp`, reject a null `auth.uid()`, resolve the caller’s personal space, and verify that the selected account belongs to that space.

- [ ] **Step 5: Add CRUD and listing RPCs**

Implement the following signatures with exact ownership and input validation:

```sql
create function public.get_personal_benefits(p_period_start date default date_trunc('month', current_date)::date) returns jsonb;
create function public.create_personal_benefit(p_account_id uuid, p_merchant_name text, p_aliases text[], p_weekdays smallint[], p_valid_from date, p_valid_until date, p_rate_bps integer, p_purchase_cap numeric, p_currency text, p_channel text, p_conditions text, p_source_url text, p_status text default 'draft') returns uuid;
create function public.update_personal_benefit(
  p_benefit_id uuid,
  p_account_id uuid,
  p_merchant_name text,
  p_aliases text[],
  p_weekdays smallint[],
  p_valid_from date,
  p_valid_until date,
  p_rate_bps integer,
  p_purchase_cap numeric,
  p_currency text,
  p_channel text,
  p_conditions text,
  p_source_url text,
  p_status text
) returns void;
create function public.duplicate_personal_benefit(p_benefit_id uuid, p_valid_from date, p_valid_until date) returns uuid;
create function public.disable_personal_benefit(p_benefit_id uuid) returns void;
```

`get_personal_benefits` must return each active/draft/expired promotion for the requested month with account label, canonical merchant, aliases, derived rebate cap, used purchase, used rebate, remaining purchase, remaining rebate, and source metadata. Used amounts must be derived only from applications in the promotion’s validity period.

- [ ] **Step 6: Extend the idempotent transaction RPC atomically**

Drop and recreate the current 10-argument function with the same signature. Preserve all existing account validation, purchase-item validation, client-operation idempotency, and return value. After the new transaction row and items are inserted, lock the matching active promotion row, calculate remaining caps from prior applications, and insert one `personal_benefit_applications` row only when `operation_type = 'card_purchase'` and all matching conditions pass. If a duplicate client operation is found, return before creating a second application. For equal-specificity matches, do not apply a benefit and return the transaction normally.

- [ ] **Step 7: Run SQL tests, then commit the database slice**

Run: `corepack pnpm exec supabase test db supabase/tests/personal_benefits_security.sql`

Expected: PASS for ownership, derived cap, alias/date matching, cap clamping, duplicate protection, and idempotent retry. Commit:

```bash
git add supabase/migrations/20260929100000_card_benefits.sql supabase/tests/personal_benefits_security.sql
git commit -m "feat: persist personal card benefits"
```

---

### Task 3: Add typed client/server access and benefit caching

**Files:**
- Create: `src/lib/benefits/benefit-payload.ts`
- Create: `src/lib/benefits/repository.ts`
- Create: `src/lib/benefits/server.ts`
- Create: `src/components/benefits/personal-benefits-provider.tsx`
- Modify: `src/lib/offline/storage.ts`
- Test: `tests/unit/benefit-payload.test.ts`
- Test: `tests/unit/offline-storage.test.ts`

**Interfaces:**
- Consumes: RPC payloads and pure domain functions from Tasks 1–2.
- Produces: `loadPersonalBenefits`, `loadPersonalBenefitsServer`, `createPersonalBenefit`, `updatePersonalBenefit`, `duplicatePersonalBenefit`, `disablePersonalBenefit`, `usePersonalBenefits`, and `useOptionalPersonalBenefits`.

- [ ] **Step 1: Write payload parser tests**

Test that a valid RPC response with numeric strings becomes typed numeric values and that missing IDs, invalid statuses, invalid caps, malformed weekday arrays, and non-array benefit payloads throw the stable `personalBenefitsLoadError` without exposing Supabase internals.

- [ ] **Step 2: Implement the parser and repository contracts**

Define repository functions with these signatures:

```ts
export async function loadPersonalBenefits(periodStart: string): Promise<PersonalBenefit[] | null>;
export async function createPersonalBenefit(draft: PersonalBenefitDraft): Promise<string>;
export async function updatePersonalBenefit(id: string, draft: PersonalBenefitDraft): Promise<void>;
export async function duplicatePersonalBenefit(id: string, validFrom: string, validUntil: string): Promise<string>;
export async function disablePersonalBenefit(id: string): Promise<void>;
```

Use the browser Supabase client and RPC names from Task 2. Normalize empty aliases, conditions, and source URLs to `null`; convert `rateBps` and amount values to the RPC’s expected exact numeric representation; map returned snake_case fields through `parsePersonalBenefitsPayload`.

- [ ] **Step 3: Add server loading**

Implement `loadPersonalBenefitsServer(periodStart: string)` with the existing server Supabase client and the same stable error behavior as `loadPersonalLedgerServer`. The benefits page and movements page will call it only after authentication and pass the result as initial provider state.

- [ ] **Step 4: Add the provider**

Create a dedicated provider instead of enlarging `PersonalFinanceProvider` with promotion CRUD. The context must expose:

```ts
type PersonalBenefitsContextValue = {
  benefits: PersonalBenefit[];
  freshness: "server" | "cached" | "offline";
  error: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  createBenefit: (draft: PersonalBenefitDraft) => Promise<void>;
  updateBenefit: (id: string, draft: PersonalBenefitDraft) => Promise<void>;
  duplicateBenefit: (id: string, validFrom: string, validUntil: string) => Promise<void>;
  disableBenefit: (id: string) => Promise<void>;
  preview: (input: BenefitMatchInput) => BenefitPreview | null;
};
```

The provider uses the current period, refreshes after every mutation, and returns a typed error for a failed load. `preview` must call `findMatchingBenefit` and `calculateBenefitPreview` only; it never writes a benefit application.

- [ ] **Step 5: Add IndexedDB benefits cache**

Increase `OFFLINE_DATABASE_VERSION` from `1` to `2`, add a `benefits` object store keyed by `userId`, and extend `OfflineStorageAdapter` with `readBenefits` and `writeBenefits`. Keep benefits isolated by user, include `periodStart` and `updatedAt`, and clear the store in `clearUserData`. A cache failure must produce the existing typed `OfflineStorageUnavailableError`; it must not block a financial movement.

- [ ] **Step 6: Test the provider/cache boundary and commit**

Run: `corepack pnpm exec vitest run tests/unit/benefit-payload.test.ts tests/unit/offline-storage.test.ts`

Expected: PASS for parser errors, per-user cache isolation, version `2`, and cleanup. Commit:

```bash
git add src/lib/benefits/benefit-payload.ts src/lib/benefits/repository.ts src/lib/benefits/server.ts src/components/benefits/personal-benefits-provider.tsx src/lib/offline/storage.ts tests/unit/benefit-payload.test.ts tests/unit/offline-storage.test.ts
git commit -m "feat: add benefits data access and cache"
```

---

### Task 4: Build the `Beneficios` page and manual promotion form

**Files:**
- Create: `src/app/beneficios/page.tsx`
- Create: `src/components/benefits/benefits-content.tsx`
- Create: `src/components/benefits/benefit-form.tsx`
- Create: `src/components/benefits/benefit-card.tsx`
- Modify: `src/lib/site.ts`
- Modify: `src/components/app-shell.tsx`
- Test: `tests/unit/benefit-form.test.tsx`
- Test: `tests/unit/benefits-content.test.tsx`

**Interfaces:**
- Consumes: the provider from Task 3 and `PersonalAccount` data from `usePersonalFinance`.
- Produces: authenticated `/beneficios`, a manual CRUD flow, and the navigation item used by later E2E tests.

- [ ] **Step 1: Read the current Next.js route guide before editing app files**

Run `Get-ChildItem -Recurse node_modules\next\dist\docs` and read the route/layout guide present in this repository. Confirm the page uses the existing async App Router page pattern, redirects unauthenticated users to `/acceso`, and wraps client components in providers rather than importing server-only clients into them.

- [ ] **Step 2: Write form tests for the approved states**

Mock `usePersonalFinance` with no credit cards and with two credit cards, and mock `usePersonalBenefits` with `createBenefit`. Assert that the card selector lists only `accountType === "credit_card"`, the no-card state links to `/cuentas`, a provider error shows the retry message, and entering `20` plus `600000` displays `₲120.000` without a separate rebate-cap input. Submit a valid draft and assert the RPC draft contains `rateBps: 2000`, the selected account ID, dates, weekdays, source URL, and status `draft`.

- [ ] **Step 3: Implement the navigation and route shell**

Add `{ label: "Beneficios", href: "/beneficios", icon: "discount" }` to `site.navigation`, extend `IconName` with `discount` if necessary, and change the mobile nav grid so seven items wrap as a balanced `grid-cols-4` layout while the desktop sidebar remains vertical. The page must load the current month’s benefits server-side, render an empty ledger safely if the initial finance load fails, and wrap `AppShell`, `PersonalFinanceProvider`, and `PersonalBenefitsProvider` in the same order used by other authenticated finance pages.

- [ ] **Step 4: Implement the benefit form**

Build `BenefitForm` as a client component with controlled fields for exact card account, merchant, aliases, weekdays, recurrence, validity, percentage, purchase cap, currency, channel, conditions, source URL, and status. Use the existing `MoneyInput` for the purchase cap. Convert percentage input to basis points and display the derived formula:

```ts
const rateBps = Math.round(Number(ratePercent) * 100);
const rebateCap = calculateRebateCap(Number(purchaseCap), rateBps);
```

The form must disable submission when no card exists, distinguish provider load errors from an empty card list, and show server validation messages without clearing the draft. Add a `Duplicar período anterior` action through the provider, with new validity dates selected by the user.

- [ ] **Step 5: Implement the list and cards**

Group benefits by account, provide a month selector, and render `BenefitCard` with used/remaining purchase and used/remaining rebate. Use `Math.min(used / cap, 1) * 100` only for visual width; display the exact formatted amount with `MoneyValue`. Show source URL as an ordinary external link, conditions, valid dates, status, and actions for duplicate/disable. Do not add a live fetch of the source URL.

- [ ] **Step 6: Run component tests and commit**

Run: `corepack pnpm exec vitest run tests/unit/benefit-form.test.tsx tests/unit/benefits-content.test.tsx tests/unit/app-shell.test.tsx`

Expected: PASS for navigation, card selector, empty/error states, derived cap, source display, two progress values, and CRUD callbacks. Commit:

```bash
git add src/app/beneficios/page.tsx src/components/benefits/benefits-content.tsx src/components/benefits/benefit-form.tsx src/components/benefits/benefit-card.tsx src/lib/site.ts src/components/app-shell.tsx tests/unit/benefit-form.test.tsx tests/unit/benefits-content.test.tsx
git commit -m "feat: add benefits navigation and management UI"
```

---

### Task 5: Integrate automatic calculation into card purchases

**Files:**
- Modify: `src/app/movimientos/page.tsx`
- Modify: `src/components/movements/operation-form.tsx`
- Modify: `tests/unit/operation-form.test.tsx`

**Interfaces:**
- Consumes: `useOptionalPersonalBenefits().preview`, cached active benefits, and the existing `recordTransaction` contract.
- Produces: automatic in-form feedback for matching card purchases; the existing transaction submit path remains the only save action.

- [ ] **Step 1: Write failing operation-form tests**

Add a mocked matching promotion and assert:

```ts
it("shows the benefit calculation automatically without an apply button", async () => {
  render(<OperationForm accounts={accounts} initialOperationType="card_purchase" />);
  fireEvent.change(screen.getByLabelText("Tarjeta de crédito"), { target: { value: "credit-1" } });
  fireEvent.change(screen.getByLabelText("Importe"), { target: { value: "85000" } });
  fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-09-15" } });
  fireEvent.change(screen.getByLabelText("Comercio"), { target: { value: "Biggie" } });

  expect(await screen.findByText(/reintegro estimado/i)).toBeInTheDocument();
  expect(screen.getByText(/disponible para compras/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /aplicar beneficio/i })).not.toBeInTheDocument();
});
```

Also assert that a non-matching merchant still calls `recordTransaction` with the normal card-purchase draft and no benefit-specific field.

- [ ] **Step 2: Pass initial benefits to the movement route**

In `src/app/movimientos/page.tsx`, load the current period’s benefits after authentication and wrap `MovementsContent` with `PersonalBenefitsProvider`. If benefit loading fails, keep the movement form usable and show no automatic benefit preview; the financial ledger error path must remain independent.

- [ ] **Step 3: Render the automatic result in `OperationForm`**

Use `useOptionalPersonalBenefits` so existing isolated component tests and non-benefit contexts remain valid. Recompute the preview when operation type, source account, amount, merchant, date, or currency changes. Only call the preview for `operationType === "card_purchase"`, a selected card, a positive amount, a non-empty merchant, and a valid date. Render a `role="status"` block with the matched benefit, derived rebate, accumulated purchase/rebate, and remaining caps. Render a neutral “no coincide” message only after the required fields are complete; do not block saving.

- [ ] **Step 4: Refresh benefit summaries after a successful save**

After `recordTransaction` resolves, call the optional benefits provider `refresh()` before clearing the form. The server RPC creates the immutable application in the same transaction, so the next benefit list reflects the authoritative result. If refresh fails, keep the “Operación guardada” message and mark the benefits context stale rather than reporting a failed financial save.

- [ ] **Step 5: Run the movement tests and commit**

Run: `corepack pnpm exec vitest run tests/unit/operation-form.test.tsx tests/unit/movements-content.test.tsx`

Expected: PASS for automatic matched output, no apply button, normal unmatched saves, and preservation of existing operation modes. Commit:

```bash
git add src/app/movimientos/page.tsx src/components/movements/operation-form.tsx tests/unit/operation-form.test.tsx
git commit -m "feat: apply card benefits automatically to purchases"
```

---

### Task 6: Complete offline behavior, end-to-end coverage, and documentation

**Files:**
- Modify: `src/components/benefits/personal-benefits-provider.tsx`
- Modify: `src/lib/offline/storage.ts`
- Modify: `tests/e2e/offline-finance.spec.ts`
- Create: `tests/e2e/benefits.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: completed database, domain, provider, UI, and movement integration from Tasks 1–5.
- Produces: cached benefit previews, server re-evaluation after synchronization, and documented acceptance coverage.

- [ ] **Step 1: Add cached benefit hydration and pending-preview behavior**

When online, write the current period’s benefits and `updatedAt` to the per-user IndexedDB cache. When offline, hydrate the last cache and set `freshness = "cached"` or `"offline"`. Include pending local `card_purchase` drafts in the client preview calculation without writing an application locally. Render a small “cálculo con datos guardados” hint when the preview uses cached rules; never alter the ledger balance with the estimated rebate.

- [ ] **Step 2: Verify server re-evaluation after outbox sync**

Extend the existing offline E2E flow so an offline card purchase with a cached matching benefit remains queued, returns to online, syncs through the existing idempotent transaction RPC, and refreshes the benefits page with one application. Assert a retry does not create a second transaction or consume the cap twice.

- [ ] **Step 3: Add authenticated benefits E2E coverage**

In `tests/e2e/benefits.spec.ts`, use the existing authenticated fixture to cover:

1. navigation to `/beneficios`;
2. empty state when the user has no credit cards;
3. creation of an active manual benefit from a seeded credit card;
4. derived rebate cap display;
5. duplication of a monthly benefit;
6. card purchase with matching merchant/day showing the automatic calculation;
7. unmatched merchant saving as a normal movement;
8. benefit page showing updated purchase and rebate remaining values.

- [ ] **Step 4: Update README scope and verification commands**

Document that first-version promotions are manually entered, links are stored as sources rather than scraped at runtime, rebate caps are derived, estimated rebates do not affect balances, and future connectors must normalize into the same benefit model. Include the focused commands:

```powershell
corepack pnpm exec vitest run tests/unit/benefits-matching.test.ts tests/unit/benefit-form.test.tsx tests/unit/operation-form.test.tsx
corepack pnpm exec supabase test db supabase/tests/personal_benefits_security.sql
corepack pnpm test:e2e tests/e2e/benefits.spec.ts
```

- [ ] **Step 5: Run the complete quality gate and commit**

Run:

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm test:e2e
```

Expected: all commands pass; if the local Supabase instance is unavailable, report that limitation separately from code failures and retain the SQL test command for the configured environment. Commit:

```bash
git add src/components/benefits/personal-benefits-provider.tsx src/lib/offline/storage.ts tests/e2e/offline-finance.spec.ts tests/e2e/benefits.spec.ts README.md
git commit -m "test: cover offline card benefits"
```

---

## Self-review checklist

- Spec coverage: Tasks 1–2 cover exact calculations, RLS, ownership, historical applications, duplicate protection, and authoritative persistence; Tasks 3–5 cover typed access, navigation, manual configuration, card selector states, and automatic movement feedback; Task 6 covers offline cache, synchronization, E2E, and documentation.
- Placeholder scan: every implementation step contains a concrete file, interface, command, expected result, or code shape; no incomplete implementation marker remains.
- Type consistency: `PersonalBenefit`, `PersonalBenefitDraft`, `BenefitMatchInput`, `BenefitPreview`, and provider methods are defined in Task 1/3 before their consumers in Tasks 4–6.
- Boundary check: benefit calculation stays in `src/lib/benefits`, persistence stays in Supabase RPCs, UI state stays in benefits components, and the existing ledger remains responsible for account balances and transaction idempotency.
- Scope check: external promotion connectors are explicitly deferred until the manual catalog and authoritative calculator are tested.
