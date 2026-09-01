# Supabase CLI and Remote Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link this repository to Supabase project `liouotvuemrtnpbkeszq`, deploy its versioned migrations safely, and verify the application.

**Architecture:** Run the Supabase CLI through `npx`, link it to the approved non-secret project reference, and compare remote migration history before deployment. A dry-run must be reviewed before `db push`; no app code changes are made merely to deploy the schema.

**Tech Stack:** Supabase CLI, hosted Supabase PostgreSQL, Next.js 16, TypeScript, Vitest, Playwright.

## Global Constraints

- Target only Supabase project `liouotvuemrtnpbkeszq`.
- Never display, commit, or store a personal access token, database password, `service_role` key, or `.env.local` value.
- Use `npx supabase@latest`; do not globally install the CLI.
- Review `migration list` and `db push --dry-run` before a remote write.
- Never run `supabase db reset --linked`.
- Stop on an unexpected migration mismatch; do not invoke `migration repair` without user direction.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `.env.local` | Untracked public client configuration, verified only for non-empty required names. |
| `supabase/config.toml` | Non-secret CLI project configuration created by `supabase init`. |
| `supabase/migrations/20260821_identity_security.sql` | Profiles, spaces, memberships, trigger, grants, and RLS baseline. |
| `supabase/migrations/20260827090000_shared_groups.sql` | Shared-group RPC and personal-space uniqueness update. |
| `supabase/migrations/20260827100000_movements.sql` | Movements schema, grants, index, and RLS. |
| `supabase/tests/*.sql` | Local pgTAP authorization regression suites. |

### Task 0: Make migration versions unique

**Files:**
- Rename: `supabase/migrations/20260827_shared_groups.sql` to `supabase/migrations/20260827090000_shared_groups.sql`.
- Rename: `supabase/migrations/20260827_movements.sql` to `supabase/migrations/20260827100000_movements.sql`.
- Modify: none; SQL contents remain byte-for-byte unchanged.
- Test: inspect migration filenames.

**Interfaces:**
- Consumes: two unapplied migration files whose duplicate `20260827` prefix cannot be tracked independently by Supabase migration history.
- Produces: unique chronological migration versions after `20260821_identity_security.sql`.

- [ ] **Step 1: Verify source and target paths.**

Run: `Test-Path supabase/migrations/20260827_shared_groups.sql; Test-Path supabase/migrations/20260827_movements.sql; Test-Path supabase/migrations/20260827090000_shared_groups.sql; Test-Path supabase/migrations/20260827100000_movements.sql`

Expected: `True`, `True`, `False`, `False` in that order.

- [ ] **Step 2: Rename only the migration files.**

Run: `Move-Item -LiteralPath supabase/migrations/20260827_shared_groups.sql -Destination supabase/migrations/20260827090000_shared_groups.sql; Move-Item -LiteralPath supabase/migrations/20260827_movements.sql -Destination supabase/migrations/20260827100000_movements.sql`

Expected: both new paths exist and no SQL content changes occur.

- [ ] **Step 3: Confirm version order.**

Run: `Get-ChildItem supabase/migrations -File | Sort-Object Name | Select-Object -ExpandProperty Name`

Expected: identity security, shared groups, then movements in ascending filename order.

- [ ] **Step 4: Commit the rename.**

Run: `git add supabase/migrations/20260827090000_shared_groups.sql supabase/migrations/20260827100000_movements.sql; git commit -m "chore: give Supabase migrations unique versions"`

Expected: one commit containing both renamed migration files and no unrelated files.

### Task 1: Confirm safe local prerequisites

**Files:**
- Verify: `.env.local`
- Modify: none.
- Test: environment-variable presence check.

**Interfaces:**
- Consumes: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Produces: only a boolean configuration report.

- [ ] **Step 1: Confirm the local configuration exists.**

Run:

```powershell
Test-Path .env.local
```

Expected: `True`.

- [ ] **Step 2: Confirm required names are non-empty without printing values.**

Run:

```powershell
$envLines = Get-Content .env.local
$requiredNames = 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
$requiredNames | ForEach-Object {
  $match = $envLines | Where-Object { $_ -match "^$_=" } | Select-Object -First 1
  [pscustomobject]@{ Name = $_; Configured = [bool]($match -and $match.Split('=', 2)[1].Trim()) }
} | Format-Table -AutoSize
```

Expected: both rows show `Configured` as `True`.

- [ ] **Step 3: Stop if either variable is missing.**

Expected: request its correction and do not use the CLI.

### Task 2: Configure and link the Supabase CLI

**Files:**
- Create: `supabase/config.toml`.
- Modify: none.
- Test: CLI version and successful project link.

**Interfaces:**
- Consumes: project reference `liouotvuemrtnpbkeszq` and a personal access token entered only by the operator at the CLI prompt.
- Produces: non-secret CLI config linked to the target project.

- [ ] **Step 1: Resolve the CLI using `npx`.**

Run:

```powershell
npx supabase@latest --version
```

Expected: a Supabase CLI version is printed.

- [ ] **Step 2: Create local CLI configuration.**

Run:

```powershell
npx supabase@latest init
```

Expected: `supabase/config.toml` exists and migrations are unchanged.

- [ ] **Step 3: Authenticate without sharing a token in chat.**

Run in an interactive terminal:

```powershell
npx supabase@latest login
```

Expected: the operator enters a dashboard-generated personal access token locally and CLI reports success.

- [ ] **Step 4: Link precisely the approved project.**

Run:

```powershell
npx supabase@latest link --project-ref liouotvuemrtnpbkeszq
```

Expected: CLI confirms this project is linked. If it requests the database password, the operator enters it only in the local prompt.

- [ ] **Step 5: Commit only the non-secret config.**

Run:

```powershell
git add supabase/config.toml
git commit -m "chore: configure Supabase CLI project"
```

Expected: the commit does not contain `.env.local`.

### Task 3: Inspect and preview remote deployment

**Files:**
- Verify: `supabase/migrations/20260821_identity_security.sql`
- Verify: `supabase/migrations/20260827090000_shared_groups.sql`
- Verify: `supabase/migrations/20260827100000_movements.sql`
- Modify: none.
- Test: remote migration history and dry-run.

**Interfaces:**
- Consumes: linked project and three ordered local migrations.
- Produces: reviewed list of remote writes that would occur.

- [ ] **Step 1: Compare migration histories.**

Run:

```powershell
npx supabase@latest migration list --linked
```

Expected: local and remote columns display migration timestamps.

- [ ] **Step 2: Stop if any mismatch is not explained by the three local files.**

Expected: report the table and do not repair or write migration history.

- [ ] **Step 3: Preview deployment without mutating the database.**

Run:

```powershell
npx supabase@latest db push --linked --dry-run
```

Expected: only identity/security, shared-groups, and movements migrations are listed in chronological order.

### Task 4: Apply and confirm database migrations

**Files:**
- Verify: all `supabase/migrations/*.sql` files.
- Modify: remote database schema and its migration-history table only.
- Test: post-deployment migration list.

**Interfaces:**
- Consumes: reviewed dry-run.
- Produces: remote profiles, financial spaces, memberships, group RPC, movements, grants, and RLS policies.

- [ ] **Step 1: Apply the reviewed migration set.**

Run:

```powershell
npx supabase@latest db push --linked
```

Expected: every pending migration completes successfully.

- [ ] **Step 2: Confirm remote history matches local migration files.**

Run:

```powershell
npx supabase@latest migration list --linked
```

Expected: each local migration timestamp has a remote counterpart.

- [ ] **Step 3: Stop if a SQL or history error occurs.**

Expected: capture the non-sensitive error, make no repair, no `--include-all` retry, and no destructive reset.

### Task 5: Verify quality, security tests, and checkpoint

**Files:**
- Verify: `supabase/tests/shared_groups_security.sql`
- Verify: `supabase/tests/movements_security.sql`
- Modify: `docs/implementation-phases.md` after validation.
- Test: full application quality gate and pgTAP suites when Docker is available.

**Interfaces:**
- Consumes: deployed schema and existing tests.
- Produces: auditable validation evidence without production seed data.

- [ ] **Step 1: Run static, unit, build, and browser verification.**

Run:

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm test:e2e
```

Expected: all commands exit with code `0`.

- [ ] **Step 2: Check whether Docker can run local Supabase pgTAP tests.**

Run:

```powershell
docker version --format '{{.Server.Version}}'
```

Expected: Docker prints a server version. If unavailable, document this limitation and do not install testing extensions remotely.

- [ ] **Step 3: Start local Supabase only when Docker is available.**

Run:

```powershell
npx supabase@latest start
```

Expected: local services start and apply every local migration.

- [ ] **Step 4: Run local authorization suites after the stack starts.**

Run:

```powershell
npx supabase@latest test db supabase/tests/shared_groups_security.sql
npx supabase@latest test db supabase/tests/movements_security.sql
```

Expected: both pgTAP suites pass.

- [ ] **Step 5: Record actual results.**

Modify `docs/implementation-phases.md` by appending `### Validación de Supabase CLI — 2026-08-28` with the project reference, migration outcome, command results, and any Docker limitation.

- [ ] **Step 6: Review and commit only intentional project changes.**

Run:

```powershell
git status --short
git add docs/implementation-phases.md supabase src/app/auth src/app/grupos/page.tsx src/app/movimientos/page.tsx src/components/groups src/components/movements tests/unit
git commit -m "feat: connect Supabase groups and movements"
git status --short
```

Expected: `.env.local`, `asdf.txt`, generated files, and unrelated paths are not staged or deleted.

## Plan Self-Review

- **Spec coverage:** Tasks 1–2 protect credentials and establish CLI access; Tasks 3–4 inspect before deploying the schema; Task 5 runs quality and records the outcome.
- **Placeholder scan:** Project reference, paths, commands, stop conditions, and expected outputs are concrete.
- **Consistency:** The same linked project is used throughout, and every remote mutation is preceded by a dry-run.
