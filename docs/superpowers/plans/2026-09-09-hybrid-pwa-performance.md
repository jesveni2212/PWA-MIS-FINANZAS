# PWA híbrida de rendimiento y sincronización Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que la aplicación muestre datos útiles sin esperas artificiales, reutilice datos recientes localmente y permita registrar movimientos personales sin conexión con sincronización segura.

**Architecture:** El servidor entregará el snapshot inicial del ledger y el shell recibirá los datos de sesión necesarios para evitar consultas posteriores al montar React. Un proveedor cliente mantendrá un store en memoria, una caché `IndexedDB` por usuario y una cola de movimientos offline; Supabase seguirá siendo la fuente definitiva y usará idempotencia para tolerar reintentos. El Service Worker solo cacheará recursos estáticos versionados y nunca HTML privado ni respuestas de Supabase.

**Tech Stack:** Next.js 16.3.1 App Router, React 19.2.8, TypeScript, Supabase SSR/PostgREST/RPC, PostgreSQL, IndexedDB nativo, Service Worker nativo, Vitest, Testing Library y Playwright.

## Global Constraints

- La primera carga de las pantallas personales usará datos iniciales obtenidos desde el servidor.
- El cliente tendrá una caché por usuario en `IndexedDB` para cuentas y movimientos personales recientes.
- Sin conexión se podrán consultar las cuentas guardadas y registrar movimientos personales; las altas de cuentas requerirán conexión.
- Los movimientos pendientes se sincronizarán en orden y tendrán un identificador idempotente.
- Grupos, invitaciones y perfil permanecerán online-first en esta etapa.
- El Service Worker almacenará recursos estáticos, nunca HTML personalizado ni respuestas privadas de Supabase.
- No se agregará una dependencia runtime de caché o estado remoto; el almacenamiento local usará IndexedDB nativo.
- Supabase conservará la autorización mediante `auth.uid()` y RLS; la caché local nunca otorgará permisos.
- Se ejecutará una validación completa al terminar todos los cambios, además de pruebas focalizadas por tarea.

---

### Task 1: Contrato de ledger, lectura agrupada e idempotencia de escrituras

**Files:**
- Create: `supabase/migrations/20260909110000_hybrid_ledger_idempotency.sql`
- Create: `supabase/tests/personal_ledger_idempotency.sql`
- Create: `src/lib/finance/ledger-payload.ts`
- Modify: `src/lib/finance/types.ts`
- Modify: `src/lib/finance/personal-ledger.ts`
- Modify: `tests/unit/personal-ledger.test.ts`

**Interfaces:**
- `parsePersonalLedgerPayload(payload: unknown): PersonalLedger` validates and normalizes the JSON returned by the grouped RPC.
- `PersonalTransactionDraft.clientOperationId?: string` carries the same UUID through online and offline attempts.
- `record_personal_transaction(..., p_client_operation_id uuid default null)` returns the existing transaction UUID when the same user retries the same operation.
- `get_personal_ledger(p_limit integer default 50) returns jsonb` returns `{ accounts: PersonalAccount[], transactions: PersonalTransaction[] }` as JSON.

- [ ] **Step 1: Write failing unit tests for the grouped payload contract and client operation IDs**

Add cases to `tests/unit/personal-ledger.test.ts` that call `parsePersonalLedgerPayload` with:

```ts
expect(parsePersonalLedgerPayload({ accounts: [], transactions: [] })).toEqual({
  accounts: [],
  transactions: [],
});

expect(() => parsePersonalLedgerPayload({ accounts: [], transactions: null })).toThrow();
```

Add a transaction draft assertion showing that a UUID is preserved when passed to the Supabase RPC mock:

```ts
const draft = {
  operationType: "expense" as const,
  sourceAccountId: "account-1",
  destinationAccountId: null,
  amount: 25,
  occurredOn: "2026-09-09",
  clientOperationId: "11111111-1111-4111-8111-111111111111",
};
```

Run:

```powershell
corepack pnpm vitest run tests/unit/personal-ledger.test.ts
```

Expected: FAIL because the parser and RPC payload field do not exist yet.

- [ ] **Step 2: Add the database migration for grouped reads and idempotent writes**

In `20260909110000_hybrid_ledger_idempotency.sql`:

1. Add nullable `client_operation_id uuid` to `public.personal_transactions`.
2. Create a partial unique index on `(created_by, client_operation_id)` where `client_operation_id is not null`.
3. Replace the existing transaction RPC with a signature that adds `p_client_operation_id uuid default null` after `p_items`.
4. Before inserting, look up an existing transaction owned by `auth.uid()` with the same client operation ID and return it.
5. Insert the client operation ID with the transaction and handle the unique-index race by selecting the already-created row after a duplicate conflict.
6. Preserve every existing account-type, currency, item, and ownership validation.
7. Create `get_personal_ledger(p_limit integer default 50)` as an authenticated, `security definer` function with `set search_path = public, pg_temp`.
8. Resolve the caller’s personal space using the existing owner/membership checks.
9. Return account fields from `personal_account_balances` and the newest transactions ordered by `occurred_on desc, id desc`, limited to `greatest(1, least(coalesce(p_limit, 50), 200))`.
10. Nest purchase items under their transaction using `jsonb_agg`; use empty JSON arrays instead of null arrays.
11. Return a top-level JSON object with exactly `accounts` and `transactions` keys.
12. Revoke execution from `public` and grant execution only to `authenticated`.

The migration must be additive for existing transactions and must not delete or rewrite historical rows.

- [ ] **Step 3: Add SQL security and idempotency regression tests**

In `supabase/tests/personal_ledger_idempotency.sql`, create two authenticated test identities and assert:

```sql
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
```

Also assert that a second identity cannot see the first identity’s ledger JSON or reuse the first identity’s client operation ID to access its transaction.

- [ ] **Step 4: Implement the parser and update the client loader/writer**

Implement `parsePersonalLedgerPayload` as a pure runtime validator. It must normalize numeric strings to numbers, preserve nullable text, default missing `items` to `[]`, and throw a generic ledger error for malformed data.

Change `loadPersonalLedger` to perform one `rpc("get_personal_ledger", { p_limit: 200 })` call and pass the result through the parser. Change `recordPersonalTransaction` to generate a UUID with `crypto.randomUUID()` when the draft has no `clientOperationId`, then pass `p_client_operation_id` to the RPC. Keep the current account and purchase-item validation before the RPC.

The relevant call shape must be:

```ts
await createClient().rpc("record_personal_transaction", {
  p_operation_type: draft.operationType,
  p_source_account_id: draft.sourceAccountId,
  p_destination_account_id: draft.destinationAccountId,
  p_amount: draft.amount,
  p_occurred_on: draft.occurredOn,
  p_category: nullableText(draft.category),
  p_note: nullableText(draft.note),
  p_merchant: nullableText(draft.merchant),
  p_items: items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
  })),
  p_client_operation_id: draft.clientOperationId ?? crypto.randomUUID(),
});
```

- [ ] **Step 5: Run the focused tests and commit the contract**

Run:

```powershell
corepack pnpm vitest run tests/unit/personal-ledger.test.ts
corepack pnpm typecheck
```

Expected: both commands pass. Commit:

```powershell
git add -f supabase/migrations/20260909110000_hybrid_ledger_idempotency.sql supabase/tests/personal_ledger_idempotency.sql src/lib/finance/ledger-payload.ts src/lib/finance/types.ts src/lib/finance/personal-ledger.ts tests/unit/personal-ledger.test.ts
git commit -m "feat: add grouped ledger reads and idempotent writes"
```

### Task 2: Server-first snapshots and shared authenticated shell data

**Files:**
- Create: `src/lib/auth/server-session.ts`
- Create: `src/lib/finance/personal-ledger-server.ts`
- Create: `src/components/finance/personal-finance-provider.tsx`
- Create: `tests/unit/server-session.test.ts`
- Create: `tests/unit/personal-finance-provider.test.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/cuentas/page.tsx`
- Modify: `src/app/movimientos/page.tsx`
- Modify: `src/app/grupos/page.tsx`
- Modify: `src/app/perfil/page.tsx`
- Modify: `src/lib/auth/paths.ts`
- Modify: `src/proxy.ts`
- Modify: `src/components/app-shell.tsx`

**Interfaces:**
- `getServerSessionData(): Promise<{ userId: string; displayName: string | null } | null>` is wrapped in `cache()` so calls in one request are deduplicated.
- `loadPersonalLedgerServer(limit?: number): Promise<PersonalLedger>` calls the grouped RPC through the server Supabase client.
- `PersonalFinanceProvider({ userId, initialLedger, children })` owns the client-side personal ledger store and exposes it to descendants.
- `AppShell({ children, displayName })` receives the greeting data instead of calling Supabase from an effect.

- [ ] **Step 1: Write failing tests for server session and provider initialization**

Test that `getServerSessionData` returns `null` without a user and returns the profile display name when the authenticated user exists. Test that `PersonalFinanceProvider` renders its `initialLedger` on the first client render and does not show a loading-only state.

The provider test must use this initial value:

```ts
const initialLedger = {
  accounts: [{
    id: "account-1",
    spaceId: "space-1",
    accountType: "bank" as const,
    institution: "Banco",
    name: "Caja",
    currency: "PYG",
    currentBalance: 500000,
  }],
  transactions: [],
};
```

Run:

```powershell
corepack pnpm vitest run tests/unit/server-session.test.ts tests/unit/personal-finance-provider.test.tsx
```

Expected: FAIL because the server helper and provider do not exist.

- [ ] **Step 2: Implement the server helpers**

`getServerSessionData` must use `createClient` from `src/lib/supabase/server`, call `auth.getUser`, return `null` on an auth error or missing user, and then select only `display_name` from `profiles` by the user ID. It must never return an access token.

`loadPersonalLedgerServer(limit = 50)` must call the grouped RPC with `{ p_limit: limit }`, pass the response through `parsePersonalLedgerPayload`, and throw the existing generic load error on RPC failure.

Use `cache` only around request-scoped helper functions. Do not place mutable ledger data in a module-level server variable.

- [ ] **Step 3: Implement the provider with initial state and a per-user memory snapshot**

Create a client provider with this public shape:

```ts
type PersonalFinanceProviderProps = {
  userId: string;
  initialLedger: PersonalLedger;
  children: ReactNode;
};

type PersonalFinanceContextValue = {
  ledger: PersonalLedger;
  freshness: "server" | "cached" | "offline";
  lastUpdatedAt: string | null;
  pendingCount: number;
  isSyncing: boolean;
  refresh: () => Promise<void>;
  recordTransaction: (
    draft: PersonalTransactionDraft,
    accounts: PersonalAccount[],
  ) => Promise<void>;
};
```

Initialize the visible state from `initialLedger` synchronously. Keep a browser-only `Map<string, PersonalLedger>` keyed by `userId` to make a route revisit paint the latest in-memory snapshot before revalidation. Do not read `localStorage` for financial data.

Expose a strict `usePersonalFinance` hook that throws a developer-facing error when used outside the provider; expose a separate `useOptionalPersonalFinance` hook for `AppShell` status rendering on pages without the provider.

- [ ] **Step 4: Convert the protected pages and shell to server-first composition**

Make the home, accounts, and movements pages async. Each must obtain `session = await getServerSessionData()`, redirect to `/acceso` when it is null, obtain `initialLedger = await loadPersonalLedgerServer(50)`, and render:

```tsx
<PersonalFinanceProvider userId={session.userId} initialLedger={initialLedger}>
  <AppShell displayName={session.displayName}>{content}</AppShell>
</PersonalFinanceProvider>
```

For groups and profile, use the same session helper and render `AppShell displayName={session.displayName}` without a finance provider. Add `/cuentas` to `privatePaths` and to the proxy matcher so account pages have the same anonymous redirect as the other protected routes. Remove the client-side `auth.getUser` and `profiles` query from `AppShell`; preserve the greeting, balance visibility, active navigation, and mobile/desktop markup.

Keep the existing `tipo` search parameter behavior in the movements page.

- [ ] **Step 5: Run focused tests and commit the server-first boundary**

Run:

```powershell
corepack pnpm vitest run tests/unit/server-session.test.ts tests/unit/personal-finance-provider.test.tsx tests/unit/home-page.test.tsx tests/unit/app-shell.test.tsx
corepack pnpm typecheck
```

Expected: PASS. Commit:

```powershell
git add src/lib/auth/server-session.ts src/lib/finance/personal-ledger-server.ts src/components/finance/personal-finance-provider.tsx src/app/page.tsx src/app/cuentas/page.tsx src/app/movimientos/page.tsx src/app/grupos/page.tsx src/app/perfil/page.tsx src/components/app-shell.tsx tests/unit/server-session.test.ts tests/unit/personal-finance-provider.test.tsx
git commit -m "perf: render personal data from the server"
```

### Task 3: IndexedDB cache, optimistic local ledger and ordered outbox

**Files:**
- Create: `src/lib/offline/storage.ts`
- Create: `src/lib/offline/sync.ts`
- Create: `src/lib/finance/local-ledger.ts`
- Create: `tests/unit/offline-storage.test.ts`
- Create: `tests/unit/offline-sync.test.ts`
- Create: `tests/unit/local-ledger.test.ts`
- Modify: `src/components/finance/personal-finance-provider.tsx`
- Modify: `src/lib/finance/types.ts`

**Interfaces:**
- `readLedgerCache(userId: string): Promise<{ ledger: PersonalLedger; updatedAt: string } | null>`
- `writeLedgerCache(userId: string, ledger: PersonalLedger, updatedAt: string): Promise<void>`
- `enqueueTransaction(userId: string, draft: PersonalTransactionDraft): Promise<PendingTransaction>`
- `listPendingTransactions(userId: string): Promise<PendingTransaction[]>`
- `SyncDependencies` is `{ list: (userId: string) => Promise<PendingTransaction[]>; send: (draft: PersonalTransactionDraft & { clientOperationId: string }) => Promise<string>; remove: (userId: string, pendingId: string) => Promise<void>; update: (userId: string, pendingId: string, patch: Pick<PendingTransaction, "attempts" | "status" | "lastError">) => Promise<void> }`.
- `syncPendingTransactions(userId: string, dependencies: SyncDependencies): Promise<SyncResult>`
- `applyPendingTransaction(ledger: PersonalLedger, draft: PersonalTransactionDraft, pendingId: string): PersonalLedger`

The persisted outbox type is:

```ts
type PendingTransaction = {
  id: string;
  userId: string;
  draft: PersonalTransactionDraft & { clientOperationId: string };
  createdAt: string;
  attempts: number;
  status: "pending" | "review";
  lastError: string | null;
};
```

- [ ] **Step 1: Write failing pure tests for local balances and outbox ordering**

Test `applyPendingTransaction` for all five operation types:

```ts
const next = applyPendingTransaction(ledger, {
  operationType: "expense",
  sourceAccountId: "cash-1",
  destinationAccountId: null,
  amount: 100,
  occurredOn: "2026-09-09",
  clientOperationId: "22222222-2222-4222-8222-222222222222",
}, "pending-1");

expect(next.accounts.find((account) => account.id === "cash-1")?.currentBalance).toBe(400);
expect(next.transactions[0]).toMatchObject({
  id: "pending:22222222-2222-4222-8222-222222222222",
});
```

Test that a transfer changes both accounts, a card purchase increases credit debt, and a card payment decreases credit debt. Test that `listPendingTransactions` returns records ordered by `createdAt` and never mixes users.

Run:

```powershell
corepack pnpm vitest run tests/unit/local-ledger.test.ts tests/unit/offline-sync.test.ts tests/unit/offline-storage.test.ts
```

Expected: FAIL because the offline modules do not exist.

- [ ] **Step 2: Implement versioned IndexedDB storage**

Create database `mis-finanzas-offline` with schema version `1` and two stores:

- `ledger`: key `[userId]`, value `{ userId, ledger, updatedAt }`;
- `outbox`: key `[userId, createdAt, id]`, indexed by `userId` and `status`.

Implement open/upgrade logic without importing a browser-only module at server render time. If IndexedDB is unavailable, return `null` for reads and throw a typed `OfflineStorageUnavailableError` for writes; the provider will fall back to the in-memory state and explain that the device cannot store offline data.

All storage methods must verify the requested `userId` before returning or mutating a record. `clearUserData(userId)` must delete both stores for only that user.

- [ ] **Step 3: Implement the local ledger reducer**

Implement `applyPendingTransaction` as a pure function. It must:

1. Clone the ledger without mutating the server snapshot.
2. Create a local transaction with `id = "pending:" + clientOperationId`, `currency` inferred from the source or destination account, and `items` normalized from the draft.
3. Apply the balance delta for `income`, `expense`, `card_purchase`, `transfer`, and `card_payment` using the same rules as `personal_account_balances`.
4. Add the pending transaction at the beginning of the transaction list.
5. Avoid adding it a second time when the same client operation ID is already present.

Add optional client-only metadata to `PersonalTransaction`:

```ts
syncStatus?: "synced" | "pending" | "review";
clientOperationId?: string;
```

- [ ] **Step 4: Implement ordered synchronization with retry classification**

`syncPendingTransactions` must:

1. Load the current user’s pending records in creation order.
2. Stop before network work when `navigator.onLine === false`.
3. Submit one record at a time using its stable `clientOperationId`.
4. Remove a record after a successful RPC and continue with the next one.
5. Increment `attempts` and retain `status: "pending"` for `TypeError`, `AbortError`, HTTP 408, HTTP 429, and HTTP 5xx failures.
6. Set `status: "review"` and `lastError` for validation, authorization, or malformed-payload errors.
7. Return `{ syncedCount, pendingCount, reviewCount }`.

Use the idempotent database RPC for every retry; never generate a new client operation ID during synchronization.

- [ ] **Step 5: Connect the provider to cache, offline events and optimistic writes**

On mount, the provider must:

- use the initial/server or memory snapshot immediately;
- read the user’s IndexedDB snapshot and use it only when it is newer than the initial snapshot or when the initial read failed;
- call `refresh` when online to replace the cache with the grouped RPC result;
- merge visible pending transactions after every server refresh;
- subscribe once to `online`, `offline`, `visibilitychange`, and `storage` only where the event is necessary;
- call `syncPendingTransactions` on mount, on `online`, on visibility, and after an online write.

`recordTransaction` must validate the draft first. If offline, it must enqueue the draft, apply the local reducer immediately, expose `pendingCount`, and resolve without waiting for Supabase. If online, it must attempt the RPC; a retryable network error is enqueued with the same operation ID, while a validation error is thrown to the form.

- [ ] **Step 6: Run focused tests and commit offline storage**

Run:

```powershell
corepack pnpm vitest run tests/unit/local-ledger.test.ts tests/unit/offline-sync.test.ts tests/unit/offline-storage.test.ts tests/unit/personal-finance-provider.test.tsx
corepack pnpm typecheck
```

Expected: PASS. Commit:

```powershell
git add src/lib/offline/storage.ts src/lib/offline/sync.ts src/lib/finance/local-ledger.ts src/components/finance/personal-finance-provider.tsx src/lib/finance/types.ts tests/unit/offline-storage.test.ts tests/unit/offline-sync.test.ts tests/unit/local-ledger.test.ts tests/unit/personal-finance-provider.test.tsx
git commit -m "feat: cache personal finance data and queue offline movements"
```

### Task 4: Migrate dashboard, accounts and movements to the shared store

**Files:**
- Modify: `src/components/dashboard/personal-dashboard.tsx`
- Modify: `src/components/accounts/accounts-content.tsx`
- Modify: `src/components/movements/movements-content.tsx`
- Modify: `src/components/movements/operation-form.tsx`
- Modify: `src/components/accounts/account-form.tsx`
- Modify: `tests/unit/personal-dashboard.test.tsx`
- Modify: `tests/unit/accounts-content.test.tsx`
- Modify: `tests/unit/movements-content.test.tsx`
- Modify: `tests/unit/operation-form.test.tsx`

**Interfaces:**
- `PersonalDashboard`, `AccountsContent`, and `MovementsContent` read `ledger`, `refresh`, and status from `usePersonalFinance`.
- `AccountForm` keeps account creation online-only and calls `refresh` after a successful insert.
- `OperationForm` calls `recordTransaction` and does not own a second ledger loader.

- [ ] **Step 1: Replace effect-based ledger loading with context reads**

Remove `loadPersonalLedger` imports, `loading` state, `load` callbacks, and `setTimeout(0)` effects from the three content components. Render the provider’s initial ledger immediately. Keep an error state only for a failed revalidation and preserve the existing retry action by calling `refresh`.

- [ ] **Step 2: Connect forms to the provider mutation API**

Change the movement form callback from “reload all data after creation” to a mutation callback that calls `recordTransaction`. Keep existing operation validation, localized money parsing, and purchase-item normalization. After an online or offline save, reset the form and let the provider update the visible list.

Keep account creation connected to `refresh`, but disable its submit button and show `Necesitás conexión para crear una cuenta` when `navigator.onLine === false`.

- [ ] **Step 3: Add shared status feedback to the shell**

Create a small client component inside `AppShell` that reads the optional finance context and displays:

```text
Actualizado ahora
Actualizado hace…
Sin conexión
Sincronizando…
N movimientos pendientes
```

Use `aria-live="polite"`, keep the status visually compact, and do not render financial amounts in the status label. Preserve the approved active navigation styles on desktop and mobile.

- [ ] **Step 4: Update focused component tests**

Wrap dashboard, accounts, and movements test renders in a test provider with a deterministic ledger. Assert that the initial content is visible without a loading text, an offline movement appears with `Pendiente`, and account creation calls `refresh` rather than a second ledger query.

Run:

```powershell
corepack pnpm vitest run tests/unit/personal-dashboard.test.tsx tests/unit/accounts-content.test.tsx tests/unit/movements-content.test.tsx tests/unit/operation-form.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit the consumer migration**

```powershell
git add src/components/dashboard/personal-dashboard.tsx src/components/accounts/accounts-content.tsx src/components/movements/movements-content.tsx src/components/movements/operation-form.tsx src/components/accounts/account-form.tsx tests/unit/personal-dashboard.test.tsx tests/unit/accounts-content.test.tsx tests/unit/movements-content.test.tsx tests/unit/operation-form.test.tsx
git commit -m "perf: share personal ledger state across screens"
```

### Task 5: Secure static Service Worker caching and loading states

**Files:**
- Modify: `public/sw.js`
- Modify: `src/components/pwa-register.tsx`
- Create: `src/app/loading.tsx`
- Modify: `tests/unit/pwa-register.test.tsx`

**Interfaces:**
- Cache name: `mis-finanzas-static-v2`.
- Static cache paths: `/_next/static/`, `/brand/`, `/favicon.ico`, `/manifest.webmanifest`.
- Navigation requests and Supabase requests are always network requests.

- [ ] **Step 1: Write the Service Worker regression assertion**

Add a static-source test that reads `public/sw.js` and asserts that it does not contain `cache.add("/")`, `cache.add('/')`, or a navigation fallback to `caches.match("/")`. Assert that it contains `/_next/static/` and the new cache version.

Run:

```powershell
corepack pnpm vitest run tests/unit/pwa-register.test.tsx
```

Expected: FAIL until the Service Worker is changed.

- [ ] **Step 2: Replace the navigation cache with a static-resource cache**

Implement install/activate cleanup for `mis-finanzas-static-v2`. In the fetch handler, ignore non-GET requests, cross-origin requests, navigations, and requests whose URL targets Supabase. For same-origin static resources, return a cache hit immediately and populate the cache after a successful network response. Do not pre-cache `/`.

- [ ] **Step 3: Register the Service Worker without blocking first paint**

Keep registration in a client effect, but call:

```ts
void navigator.serviceWorker.register("/sw.js", {
  scope: "/",
  updateViaCache: "none",
});
```

Do not show a registration spinner or make page rendering depend on registration. Preserve the existing no-op behavior when Service Workers are unavailable.

- [ ] **Step 4: Add a stable app loading skeleton**

Create `src/app/loading.tsx` with the same background, panel radius, spacing, and approximate heading/list dimensions used by the protected pages. It must be presentational only and contain no Supabase or browser storage access.

- [ ] **Step 5: Run focused tests and commit PWA behavior**

Run:

```powershell
corepack pnpm vitest run tests/unit/pwa-register.test.tsx
```

Expected: PASS. Commit:

```powershell
git add public/sw.js src/components/pwa-register.tsx src/app/loading.tsx tests/unit/pwa-register.test.tsx
git commit -m "perf: cache static PWA assets safely"
```

### Task 6: End-to-end offline flow and complete validation

**Files:**
- Create: `tests/e2e/offline-finance.spec.ts`
- Create: `tests/e2e/fixtures/authenticated.ts`
- Modify: `playwright.config.ts`
- Modify: `README.md`

**Interfaces:**
- `authenticatedTest` in `tests/e2e/fixtures/authenticated.ts` logs in through `/acceso` using `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD`, then exposes the authenticated page fixture. Tests skip with a clear message when those variables are absent; no production credentials will be committed.

- [ ] **Step 1: Add an E2E test for server-first rendering**

Create the authenticated fixture by filling the existing email/password fields, submitting the form, and waiting for `/`. Navigate to `/` with that fixture and assert that the dashboard heading and account summary appear without a loading-only client state. Intercept browser-side grouped ledger calls and verify that rehydration performs at most one refresh; the server-side RSC request is not counted as a browser Supabase call.

- [ ] **Step 2: Add an E2E test for offline queue and one-time sync**

Use Playwright context offline mode after the initial ledger load. Submit an expense, assert `Pendiente` and the provisional local balance, restore the network, intercept the RPC, and assert that exactly one transaction write occurs. Reload the page and verify the pending marker disappears after the grouped ledger refresh.

- [ ] **Step 3: Add an E2E test for user isolation and offline failure**

Verify that a second authenticated test user cannot see the first user’s cached ledger. Simulate a permanent validation error during sync and assert that the item is marked `Revisar`, remains visible, and is not retried on every render.

- [ ] **Step 4: Document local setup and measurement commands**

Update `README.md` with the IndexedDB scope, the fact that offline writes cover movements but not account creation, and these measurement commands:

```powershell
corepack pnpm test:e2e
corepack pnpm build
```

Document that production measurement compares TTFB, time to visible dashboard, route navigation time, and mobile JavaScript transfer size before and after this plan.

- [ ] **Step 5: Run the complete validation once all implementation changes are complete**

Run:

```powershell
corepack pnpm test --pool=forks --maxWorkers=1
corepack pnpm typecheck
npm run lint
npm run build
corepack pnpm test:e2e
git diff --check
git status --short --branch
```

Expected: all tests, typecheck, lint, build, E2E and whitespace checks pass; the final status contains only intentional implementation changes. Commit:

```powershell
git add tests/e2e/offline-finance.spec.ts playwright.config.ts README.md
git commit -m "test: verify hybrid finance performance"
```
