# Authoritative Ledger Refresh for `syncRevision`

## Problem

`PersonalFinanceProvider` currently increments `syncRevision` after an outbox sync whenever at least one transaction was sent. The increment happens even when the follow-up `loadPersonalLedger()` fails or when that refresh is discarded because a newer snapshot advanced the generation. `PersonalBenefitsProvider` observes the revision as confirmation that authoritative financial data is available, so those false-positive increments can trigger an unnecessary benefits reload.

## Goal

Increment `syncRevision` only after a successful authoritative ledger refresh whose generation is still current. Preserve the existing outbox processing, pending transaction projection, cache behavior, and public `refresh(): Promise<void>` contract.

## Design

Keep the public `refresh` callback void-returning and introduce an internal refresh operation that returns whether it accepted an authoritative snapshot:

- `refreshLedger(): Promise<boolean>` loads the ledger, checks the captured snapshot generation, applies the accepted server snapshot, persists the cache, and returns `true` only when the refresh succeeds while its generation remains current.
- A load failure continues to reject the refresh operation and leaves `syncRevision` unchanged.
- A stale refresh returns `false` without replacing the newer ledger snapshot and leaves `syncRevision` unchanged.
- The public `refresh()` awaits the internal operation and discards its boolean result, preserving callers and error behavior.
- `synchronize()` keeps sending/removing/updating outbox records and rendering pending state exactly as before. After a non-empty sync, it increments `syncRevision` only when `refreshLedger()` returns `true`; refresh errors still mark the finance provider offline without making benefits treat the ledger as confirmed.

The accepted-generation check remains the authority for stale-refresh handling. No changes are needed in `PersonalBenefitsProvider`; its existing revision observer will now receive only confirmed revisions.

## Verification

Extend `tests/unit/personal-finance-provider.test.tsx` with regression coverage for:

1. A successful outbox send followed by a rejected ledger load: the pending record is removed, the optimistic/outbox behavior remains intact, and `syncRevision` stays at `0`.
2. A successful outbox send followed by a refresh resolved after a newer same-user server snapshot: the newer snapshot remains visible, the pending record is still resolved, and `syncRevision` stays at `0`.

Keep the existing success case that proves the revision remains `0` until the authoritative refresh completes and then becomes `1`.

## Constraints

- Do not edit `next-env.d.ts`.
- Do not edit legacy briefs.
- Do not change the benefits provider or pending projection implementation.
