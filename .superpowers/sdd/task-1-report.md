# Task 1 implementation report

Status: DONE_WITH_CONCERNS

## Implementation

- Added the benefit domain types: status, type, recurrence, channel, persisted benefit, draft, summary, match input, and preview.
- Added pure merchant normalization, rebate-cap derivation, unique benefit matching, and capped preview calculation.
- Matching checks account ID, active status, currency, valid inclusive date range, configured weekday, optional channel, and canonical or alias merchant name. Ambiguous matches return `null`.
- Added focused tests for the specified cap examples, exhausted caps, normalization, aliases, account/currency/date/weekday/status filters, and ambiguous candidates.
- `git diff --cached --check` passed before commit.

## Test output

Command: `corepack pnpm exec vitest run tests/unit/benefits-matching.test.ts`

Output:

```text
"vitest" no se reconoce como un comando interno o externo,
programa o archivo por lotes ejecutable.
exit_code=1
```

The focused test suite could not execute because the `vitest` executable is unavailable in this workspace. The command was attempted both before and after implementation and produced the same result.

## Commit

- `d417d51` — `feat: add card benefit matching domain`
- Contains only `src/lib/benefits/types.ts`, `src/lib/benefits/matching.ts`, and `tests/unit/benefits-matching.test.ts`.
- The pre-existing `next-env.d.ts` modification was not staged or committed.

## Concerns

- Runtime test results are unverified until Vitest is available. No dependency installation was performed.
- Benefit draft/summary object shapes were not specified field-by-field in the brief; the exported shapes here use the existing numeric money boundary and the persisted benefit fields.

## Reviewer finding fixes

- Replaced floating-point currency arithmetic with integer minor-unit arithmetic using `BigInt`. Finite monetary inputs are parsed from their decimal string representation into two-decimal units; excess precision is rounded half-up. Rebate calculations use integer products and explicit half-up division, and results return to the public number shape only after construction of a two-decimal decimal string.
- Added precision boundary assertions including `calculateRebateCap(1, 2000) === 0.2` and a fractional preview that rounds a 20% rebate on 1.23 to 0.25 while retaining exact two-decimal remaining amounts.
- Merchant normalization now removes punctuation while preserving existing whitespace separators, making `S.A.` normalize to the same name as `SA`. Added an alias matching regression.
- Added an explicit expired-status non-match test.

### Reviewer-fix test evidence

Command: `corepack pnpm exec vitest run tests/unit/benefits-matching.test.ts`

Output:

```text
"vitest" no se reconoce como un comando interno o externo,
programa o archivo por lotes ejecutable.
exit_code=1
```

The test runner remains unavailable in this workspace, so runtime test results for the reviewer fixes are unverified.
