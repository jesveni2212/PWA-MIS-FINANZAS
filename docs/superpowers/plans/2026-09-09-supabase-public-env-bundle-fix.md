# Supabase Public Environment Bundle Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the browser-side authentication forms recognize valid Supabase public variables embedded by the Next.js build, while preserving the safe disabled state when configuration is absent.

**Architecture:** Keep the existing configuration module as the single decision point. Replace its indirect `process.env` default with an object whose `NEXT_PUBLIC_*` properties are statically referenced, so Next.js can inline them into client bundles. Keep explicit environment injection for unit tests and leave Supabase SSR clients, proxy behavior, credentials, and database schema unchanged.

**Tech Stack:** Next.js 16.3.1, React 19, TypeScript, Supabase SSR, Vitest, pnpm.

## Global Constraints

- Public configuration consists of `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`, and `NEXT_PUBLIC_APPLE_AUTH_ENABLED`.
- Placeholder or missing URL/key values must continue to disable authentication requests and show the existing configuration notice.
- No `.env.local` values, `service_role` keys, database migrations, RLS policies, or Supabase data may be committed or changed.
- Do not modify the authentication forms, SSR clients, `src/proxy.ts`, callback route, PWA service worker, or visual copy.
- Because `NEXT_PUBLIC_*` values are fixed during `next build`, Vercel variables must be configured before the deployment used for acceptance testing.

---

## File Map

- Modify `tests/unit/supabase-config.test.ts` to add a source-level regression contract for statically analyzable public environment references.
- Modify `src/lib/supabase/config.ts:1-25` to create the default public environment from direct static references while preserving the existing validator API.
- Generate no new runtime files and do not alter deployment secrets from the repository.

### Task 1: Add a regression contract for static public environment references

**Files:**
- Modify: `tests/unit/supabase-config.test.ts`
- Test: `tests/unit/supabase-config.test.ts`

**Interfaces:**
- Consumes: `src/lib/supabase/config.ts` source text and the existing `isSupabaseConfigured`/`isProviderEnabled` tests.
- Produces: A failing regression that requires direct static references to both Supabase public variables and rejects the old indirect default.

- [ ] **Step 1: Add the file-reading imports.**

Add these imports before the existing Vitest import in `tests/unit/supabase-config.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
```

- [ ] **Step 2: Add the static-reference regression test.**

Append this test inside the existing `describe("Supabase public configuration", () => { ... })` block:

```ts
  it("keeps browser-facing Supabase variables statically analyzable", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../../src/lib/supabase/config.ts", import.meta.url)),
      "utf8",
    );

    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    expect(source).not.toContain("environment: PublicEnvironment = process.env");
  });
```

- [ ] **Step 3: Run the focused test and confirm it fails for the current implementation.**

Run:

```powershell
corepack pnpm test -- tests/unit/supabase-config.test.ts --pool=forks --maxWorkers=1
```

Expected: the existing placeholder/provider tests pass, and the new test fails because the current module has no direct static Supabase environment references and still defaults to `process.env` indirectly.

- [ ] **Step 4: Commit the red regression test.**

```powershell
git add tests/unit/supabase-config.test.ts
git commit -m "test: cover static Supabase client configuration"
```

### Task 2: Make the default browser configuration statically analyzable

**Files:**
- Modify: `src/lib/supabase/config.ts:1-25`
- Test: `tests/unit/supabase-config.test.ts`

**Interfaces:**
- Consumes: The explicit `PublicEnvironment` argument already supported by `isSupabaseConfigured` and `isProviderEnabled`.
- Produces: The same exported functions with a build-time-safe default environment.

- [ ] **Step 1: Define the default public environment with direct references.**

Immediately after the `PublicEnvironment` type, add:

```ts
const publicEnvironment: PublicEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED,
  NEXT_PUBLIC_APPLE_AUTH_ENABLED: process.env.NEXT_PUBLIC_APPLE_AUTH_ENABLED,
};
```

- [ ] **Step 2: Use the static object as the default argument.**

Change both exported function signatures to use `publicEnvironment` while keeping their explicit override behavior:

```ts
export function isSupabaseConfigured(
  environment: PublicEnvironment = publicEnvironment,
): boolean {
  return (
    hasValue(environment.NEXT_PUBLIC_SUPABASE_URL, placeholderUrl) &&
    hasValue(environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, placeholderKey)
  );
}

export function isProviderEnabled(
  provider: "google" | "apple",
  environment: PublicEnvironment = publicEnvironment,
): boolean {
  const flag = provider === "google"
    ? environment.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED
    : environment.NEXT_PUBLIC_APPLE_AUTH_ENABLED;

  return isSupabaseConfigured(environment) && flag === "true";
}
```

Do not change `hasValue`, the placeholder values, or any caller. The direct property expressions are the part Next.js must see during the client build.

- [ ] **Step 3: Run the focused tests and typecheck.**

Run:

```powershell
corepack pnpm test -- tests/unit/supabase-config.test.ts --pool=forks --maxWorkers=1
corepack pnpm typecheck
```

Expected: all tests in `supabase-config.test.ts` pass, including the new static-reference regression, and TypeScript exits with code 0.

- [ ] **Step 4: Commit the implementation.**

```powershell
git add src/lib/supabase/config.ts tests/unit/supabase-config.test.ts
git commit -m "fix: inline public Supabase environment config"
```

### Task 3: Verify the production bundle and deployment handoff

**Files:**
- Modify: none
- Test: generated `.next/static/**/*.js` and existing project test suites

**Interfaces:**
- Consumes: The statically configured `isSupabaseConfigured` module from Task 2 and the existing `.env.local` development values.
- Produces: Evidence that the client bundle contains the public Supabase URL in the same compiled client code that contains the configuration guard, plus the exact Vercel follow-up required for production.

- [ ] **Step 1: Build the production bundle.**

Run:

```powershell
corepack pnpm build
```

Expected: Next.js reports `Compiled successfully`, finishes TypeScript and static page generation, and exits with code 0.

- [ ] **Step 2: Check the compiled client bundle without printing the publishable key.**

Run from the repository root:

```powershell
$publicUrl = (Get-Content .env.local | Where-Object { $_ -match '^NEXT_PUBLIC_SUPABASE_URL=' }).Substring('NEXT_PUBLIC_SUPABASE_URL='.Length).Trim()
$matchingBundles = @(
  Get-ChildItem .next\static -Recurse -File -Filter '*.js' |
    Where-Object {
      $content = Get-Content -Raw $_.FullName
      $content.Contains($publicUrl) -and $content.Contains('isSupabaseConfigured')
    }
)
if ($matchingBundles.Count -eq 0) { throw 'The client bundle does not contain the static Supabase configuration.' }
"Verified $($matchingBundles.Count) client bundle(s) with static Supabase configuration."
```

Expected: the command prints a positive bundle count and never prints the key.

- [ ] **Step 3: Run the full unit suite with one worker to avoid the observed local worker-start timeout.**

Run:

```powershell
corepack pnpm test -- --pool=forks --maxWorkers=1
```

Expected: all unit test files and tests pass without the 15-worker timeout seen in the unconstrained run.

- [ ] **Step 4: Confirm the Vercel environment after the code fix.**

In the Vercel project connected to `jesveni2212/PWA-MIS-FINANZAS`, create these five variables for every environment being tested, especially Production and Preview:

- `NEXT_PUBLIC_SUPABASE_URL`: copy the Project URL shown in Supabase Project Settings → API.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: copy the Publishable key shown in Supabase Project Settings → API; never use `service_role`.
- `NEXT_PUBLIC_APP_URL`: enter the deployed production URL, including `https://` and without a trailing path.
- `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`: enter `false`.
- `NEXT_PUBLIC_APPLE_AUTH_ENABLED`: enter `false`.

Save the variables, then redeploy the latest `main` commit. Do not paste values into the repository or into chat.

- [ ] **Step 5: Confirm the deployed behavior.**

Open `/acceso` and `/registro` on the new deployment, enter test values, and submit. With valid Vercel variables, the forms must no longer show `La autenticación estará disponible cuando se configure el servicio.` before the Supabase request. An invalid test credential may show the normal login error; that proves the request passed the configuration guard.

Also request `/api/health` on the same deployment and expect HTTP 200 with `{ "status": "ok" }`.
