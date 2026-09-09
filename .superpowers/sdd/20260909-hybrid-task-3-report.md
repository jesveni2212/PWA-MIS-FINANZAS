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
