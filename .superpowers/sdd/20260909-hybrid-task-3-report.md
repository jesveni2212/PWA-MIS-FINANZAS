# Hybrid PWA Performance — Task 3 Report

## Status

Complete. IndexedDB-backed per-user cache and outbox, pure optimistic ledger updates, ordered synchronization, and provider integration are implemented.

Implementation commit: `a5cb886 feat: cache personal finance data and queue offline movements`.

## Changed files

- `src/lib/offline/storage.ts`
- `src/lib/offline/sync.ts`
- `src/lib/finance/local-ledger.ts`
- `src/components/finance/personal-finance-provider.tsx`
- `src/lib/finance/types.ts`
- `src/lib/finance/personal-ledger.ts`
- `tests/unit/offline-storage.test.ts`
- `tests/unit/offline-sync.test.ts`
- `tests/unit/local-ledger.test.ts`
- `tests/unit/personal-finance-provider.test.tsx`

`src/lib/finance/personal-ledger.ts` is included because it must preserve transport failures (`TypeError`, `AbortError`, and HTTP status) for the provider to queue retryable online-write failures, while retaining the existing generic message for permanent form errors.

## TDD evidence

1. Added reducer, storage, and synchronizer tests before their modules existed.
2. Ran:

   ```powershell
   .\node_modules\.bin\vitest.cmd run tests/unit/local-ledger.test.ts tests/unit/offline-sync.test.ts tests/unit/offline-storage.test.ts
   ```

   Result: expected failure — all three suites failed import resolution because `local-ledger`, `offline/sync`, and `offline/storage` did not yet exist.

3. Implemented the three modules; the same command then passed with 11 tests.
4. Added provider cache-hydration and offline optimistic-write tests before extending the provider. They failed as expected because cache hydration and `recordTransaction` were not implemented.
5. Implemented provider integration and adjusted the test expectation to the actual `500000 - 100 = 499900` balance delta.

## Validation

The requested pnpm Vitest command could not expose Vitest in this checkout:

```powershell
corepack pnpm vitest run tests/unit/local-ledger.test.ts tests/unit/offline-sync.test.ts tests/unit/offline-storage.test.ts tests/unit/personal-finance-provider.test.tsx
```

Output:

```text
"vitest" no se reconoce como un comando interno o externo,
programa o archivo por lotes ejecutable.
```

Used the direct local Vitest binary as instructed:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/local-ledger.test.ts tests/unit/offline-sync.test.ts tests/unit/offline-storage.test.ts tests/unit/personal-finance-provider.test.tsx
```

Output:

```text
Test Files  4 passed (4)
     Tests  15 passed (15)
```

Vitest emitted the pre-existing Vite warning that `vitest.config.ts` uses ESM syntax while loaded as CommonJS; it did not affect test execution.

```powershell
corepack pnpm typecheck
```

Output:

```text
$ tsc --noEmit
```

Result: passed (exit code 0).

```powershell
git diff --check
```

Result: passed (exit code 0). Git emitted only CRLF conversion notices for tracked Windows working-copy files.

The complete validation suite was intentionally not run, per Task 3 scope.

## Self-review

- Storage is opened only inside browser-invoked functions, uses `mis-finanzas-offline` schema version 1, has the required `ledger`/`outbox` stores and indexes, and never uses localStorage.
- Ledger and outbox APIs are scoped to the requested user ID; native remove/update re-check the stored user before changing an outbox record.
- Unavailable IndexedDB produces `OfflineStorageUnavailableError` for writes and `null`/empty reads; the provider retains the queued operation in memory and exposes an accessible non-blocking warning.
- Reducer copies account and transaction data, applies all five SQL-equivalent balance rules, places pending movements first, normalizes purchase items, and prevents duplicate client-operation IDs.
- Synchronization sorts by `createdAt`, sends serially, preserves client IDs, treats retryable transport/HTTP failures as pending, and retains permanent errors as review items.
- Provider overlays pending/review records on every cached or server snapshot, waits for outbox hydration before mount synchronization, subscribes once per mounted user to connectivity and visibility events, and leaves account creation untouched.

## Concerns and caveats

- The existing provider prop contract carries `initialLedger` but no server snapshot timestamp. The implementation uses the client mount time as a conservative freshness boundary, so IndexedDB replaces the server snapshot only when its stored `updatedAt` is demonstrably newer. A future server-provided snapshot timestamp would make this comparison exact.
- A pre-existing edit to `docs/superpowers/plans/2026-09-09-hybrid-pwa-performance.md` was intentionally preserved and excluded from the implementation commit.

## Fix wave: offline safety review findings

**Status:** complete.

**Implementation commit:** `899c002 fix: harden offline finance synchronization`.

### Changed files

- `src/app/page.tsx`
- `src/app/cuentas/page.tsx`
- `src/app/movimientos/page.tsx`
- `src/components/finance/personal-finance-provider.tsx`
- `src/components/profile/profile-form.tsx`
- `src/lib/offline/storage.ts`
- `src/lib/offline/sync.ts`
- `tests/unit/home-page.test.tsx`
- `tests/unit/offline-storage.test.ts`
- `tests/unit/offline-sync.test.ts`
- `tests/unit/personal-finance-provider.test.tsx`
- `tests/unit/profile-form.test.tsx`

### Findings addressed

- Server pages now produce and pass `initialLedgerUpdatedAt`; the provider compares both IndexedDB and per-user in-memory snapshots against that timestamp. A `null` timestamp marks a server ledger failure, allowing only that authenticated user's cached ledger to hydrate.
- The provider hydrates cache/outbox, triggers an online background revalidation even with no pending writes, and remounts an inner stateful provider keyed by `userId` to prevent a preserved instance from exposing another user's ledger or pending count.
- Retryable synchronization failures now stop the ordered pass. A per-provider in-flight promise coalesces mount, online, visibility, and post-write sync triggers.
- Every public IndexedDB read now returns `null`/`[]` on browser storage failures; public writes normalize open/request/transaction/quota/security failures to `OfflineStorageUnavailableError`.
- Logout best-effort clears only the active user's local ledger/outbox before `auth.signOut()`; cleanup failure cannot block sign-out.

### Failing-before evidence

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/offline-sync.test.ts tests/unit/offline-storage.test.ts tests/unit/personal-finance-provider.test.tsx tests/unit/profile-form.test.tsx
```

Result before the fixes: 5 failures across four files. The failures demonstrated raw `SecurityError` leakage from storage reads, sync continuing after a retryable failure, a newer memory snapshot being ignored, stale provider state after a user switch, and missing logout cleanup coverage.

During the server-timestamp propagation, the first typecheck correctly failed until the empty fallback snapshots were typed as `PersonalLedger`:

```powershell
corepack pnpm typecheck
```

Output before that correction:

```text
TS2322: Type 'PersonalLedger' is not assignable to type '{ accounts: never[]; transactions: never[]; }'.
```

### Focused validation

The pnpm wrapper remains unable to expose Vitest:

```powershell
corepack pnpm vitest run tests/unit/local-ledger.test.ts tests/unit/offline-sync.test.ts tests/unit/offline-storage.test.ts tests/unit/personal-finance-provider.test.tsx tests/unit/profile-form.test.tsx tests/unit/home-page.test.tsx
```

Output:

```text
"vitest" no se reconoce como un comando interno o externo,
programa o archivo por lotes ejecutable.
```

Used the direct local fallback:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/local-ledger.test.ts tests/unit/offline-sync.test.ts tests/unit/offline-storage.test.ts tests/unit/personal-finance-provider.test.tsx tests/unit/profile-form.test.tsx tests/unit/home-page.test.tsx
```

Output:

```text
Test Files  6 passed (6)
     Tests  28 passed (28)
```

```powershell
corepack pnpm typecheck
git diff --check
```

Result: both passed (exit code 0). Vitest retained the pre-existing Vite CommonJS/ESM configuration warning and JSDOM logged `Not implemented: navigation to another Document` after the successful logout redirect; neither affected assertions or command status.

### Pre-existing auth-storage caveat

`src/lib/supabase/client.ts` continues to call `createBrowserClient` without a custom Supabase auth-storage adapter. Supabase browser auth may therefore use its default browser storage for session persistence. This predates Task 3 and this fix wave does not alter login persistence. The Task 3 offline modules do not write credentials, access tokens, private HTML, or financial data to `localStorage`; financial cache/outbox data remains scoped IndexedDB only.

## Fix wave: same-user server snapshot refresh

**Status:** complete.

**Implementation commit:** `c244491 fix: adopt fresh personal ledger snapshots`.

### Changed files

- `src/components/finance/personal-finance-provider.tsx`
- `tests/unit/personal-finance-provider.test.tsx`

### Fix details

The inner provider now tracks the previous server snapshot timestamp. When the same authenticated user receives a strictly newer `initialLedgerUpdatedAt` through a preserved Next.js client component, it adopts the incoming server ledger into `baseLedgerRef`, reapplies pending optimistic operations to the visible ledger, updates memory freshness, and records the new timestamp before the timestamp-driven hydration/cache effect can persist a snapshot. A newer in-memory snapshot still wins over an older incoming server timestamp; an equal or older server timestamp is ignored.

### Failing-before evidence

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/personal-finance-provider.test.tsx
```

Result before the fix:

```text
Test Files  1 failed (1)
     Tests  1 failed | 8 passed (9)
```

The new same-user rerender regression expected `Servidor actualizado` but the preserved provider rendered `Servidor anterior`.

### Focused validation

The established pnpm wrapper cannot expose Vitest, so the direct local binary was used:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/local-ledger.test.ts tests/unit/offline-sync.test.ts tests/unit/offline-storage.test.ts tests/unit/personal-finance-provider.test.tsx tests/unit/profile-form.test.tsx
```

Output:

```text
Test Files  5 passed (5)
     Tests  27 passed (27)
```

```powershell
corepack pnpm typecheck
git diff --check
```

Result: both passed (exit code 0). The focused Vitest run retained the pre-existing Vite configuration warning and JSDOM navigation notice after logout; neither affected the results.

## Fix wave: stale in-flight refresh race

**Status:** complete.

**Implementation commit:** `e1fb61f fix: discard stale personal ledger refreshes`.

### Changed files

- `src/components/finance/personal-finance-provider.tsx`
- `tests/unit/personal-finance-provider.test.tsx`

### Fix details

The provider now maintains a monotonic snapshot generation. `refresh()` captures that generation before loading the server ledger. Adopting a strictly newer same-user RSC snapshot increments it. If an earlier refresh resolves afterward, it exits before changing the base or visible ledger, in-memory snapshot, timestamp, or IndexedDB cache. Pending optimistic operations continue to be reapplied to accepted snapshots.

The new deferred-refresh regression starts a refresh, rerenders the same user with a newer server snapshot while that refresh is pending, then resolves the old request. It verifies the newer account remains visible and the stale response is never persisted as a freshly timestamped cache entry.

### Failing-before evidence

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/personal-finance-provider.test.tsx
```

Result before the fix:

```text
Test Files  1 failed (1)
     Tests  1 failed | 9 passed (10)
```

The deferred-refresh test showed `Respuesta anterior` from the resolved old request being passed to `writeLedgerCache` with a current timestamp after the visible ledger had correctly adopted `Servidor más nuevo`.

### Focused validation

The pnpm wrapper remains unable to expose Vitest, so the direct local binary was used:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/local-ledger.test.ts tests/unit/offline-sync.test.ts tests/unit/offline-storage.test.ts tests/unit/personal-finance-provider.test.tsx tests/unit/profile-form.test.tsx
```

Output:

```text
Test Files  5 passed (5)
     Tests  28 passed (28)
```

```powershell
corepack pnpm typecheck
git diff --check
```

Result: both passed (exit code 0). Vitest retained the pre-existing Vite CommonJS/ESM configuration warning and JSDOM logged `Not implemented: navigation to another Document` after the successful logout redirect; neither affected assertions or command status. This change does not alter Task 4, reminders, or the pre-existing browser auth-storage behavior.

## Final fix: serialize stale refresh cache writes

**Status:** complete.

### Fix details

Refresh results now advance the snapshot generation when accepted, and cache writes are serialized per provider. A cache write queued by an older refresh is skipped when a newer server snapshot has been adopted; if it already started, the newer snapshot is queued behind it so the final persisted record cannot remain stale. The provider regression suite now covers a deferred cache write during a same-user server refresh.

### Validation

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/personal-finance-provider.test.tsx
```

```text
Test Files  1 passed (1)
     Tests  11 passed (11)
```

```powershell
corepack pnpm typecheck
```

Result: passed. The known Vite ESM/CommonJS configuration warning remains non-blocking.
