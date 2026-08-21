# Phase 2 Identity and Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide self-service verified accounts and ensure that users cannot access another user's financial space.

**Architecture:** Supabase Auth owns credentials, verification, recovery and OAuth. PostgreSQL provisions each confirmed identity with a profile, personal space and owner membership via one idempotent trigger. Next.js 16 Proxy refreshes sessions and redirects optimistically; server checks plus RLS remain the authorization authority.

**Tech Stack:** Next.js 16.3.1, React 19, TypeScript strict, Supabase Auth/PostgreSQL/RLS, `@supabase/supabase-js`, `@supabase/ssr`, Tailwind CSS 4, Vitest, Playwright.

## Global Constraints

- Read current guides in `node_modules/next/dist/docs/` before modifying Next.js; use `src/proxy.ts`, never `middleware.ts`.
- Never commit actual Supabase keys, OAuth secrets, user data or passwords.
- A verified email activates automatically. OAuth controls appear only when their public enabled flags are true.
- RLS and an authenticated server query must both protect profile, space and membership access.
- Do not implement financial domain data, groups, OCR, push or billing.
- Preserve the PWA and health route; use Spanish, accessible copy.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `supabase/migrations/20260821_identity_security.sql` | Schema, provisioning trigger, grants and RLS. |
| `supabase/tests/identity_security.sql` | PostgreSQL isolation proof. |
| `src/lib/auth/paths.ts` | Route policy and safe internal returns. |
| `src/lib/supabase/*.ts` | Browser, server, Route Handler and Proxy clients. |
| `src/lib/auth/session.ts` | Authoritative identity/membership data access. |
| `src/proxy.ts` | Next.js 16 proxy entry point. |
| `src/app/(public)/**` | Landing, access, registration, recovery and callback. |
| `src/app/(private)/**` | Authenticated product route group. |
| `src/components/auth/**` | Accessible client forms. |

### Task 1: Configure Supabase and route contracts

**Files:** Create `src/lib/auth/paths.ts`, `tests/unit/auth-paths.test.ts`. Modify `package.json`, `pnpm-lock.yaml`, `.env.example`.

**Interfaces:** `privatePaths`, `authPaths`, `isPrivatePath(pathname: string): boolean`, `safeReturnPath(value: string | null): string`.

- [ ] **Step 1: Install runtime packages.**

Run: `corepack pnpm add @supabase/supabase-js @supabase/ssr`

Expected: exactly those two runtime dependencies are added.

- [ ] **Step 2: Write the failing test.** Create `tests/unit/auth-paths.test.ts` that asserts `/perfil` and `/movimientos?mes=8` are accepted; `null`, `https://bad.test`, `//bad.test` and `/acceso` return `/resumen`; and only `/resumen`, `/movimientos`, `/grupos`, `/perfil` are private.

- [ ] **Step 3: Run the focused test.**

Run: `corepack pnpm test tests/unit/auth-paths.test.ts`

Expected: FAIL because `@/lib/auth/paths` does not exist.

- [ ] **Step 4: Implement the policy.** Create `paths.ts` with `privatePaths = ["/resumen", "/movimientos", "/grupos", "/perfil"] as const`, `authPaths = ["/acceso", "/registro", "/recuperar-contrasena"] as const`; accept a return only when it begins with one slash, not two, and is not an auth path. Otherwise return `/resumen`.

- [ ] **Step 5: Replace `.env.example`.** Include only `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false`, and `NEXT_PUBLIC_APPLE_AUTH_ENABLED=false`, all with dummy values.

- [ ] **Step 6: Verify and commit.**

Run: `corepack pnpm test tests/unit/auth-paths.test.ts; corepack pnpm lint; corepack pnpm typecheck`

Expected: all commands exit 0.

Run: `git add package.json pnpm-lock.yaml .env.example src/lib/auth/paths.ts tests/unit/auth-paths.test.ts`

Run: `git commit -m "chore: configure Supabase auth dependencies"`

### Task 2: Provision a secure profile, personal space and membership

**Files:** Create `supabase/migrations/20260821_identity_security.sql`, `supabase/tests/identity_security.sql`.

**Interfaces:** Tables `profiles`, `financial_spaces`, `memberships`; SQL function/trigger `public.handle_new_auth_user()`.

- [ ] **Step 1: Write failing pgTAP assertions.** The test inserts Alice and Bob through `auth.users`, then asserts Alice has one profile, one `personal` space and one `owner` membership. It sets `request.jwt.claim.sub` to Alice and expects one visible space, sets it to Bob and expects zero Alice spaces, then asserts Bob's direct membership insert raises `42501`.

- [ ] **Step 2: Confirm the test fails.**

Run: `npx supabase test db --local --file supabase/tests/identity_security.sql`

Expected: FAIL because application tables do not exist. Configure the CLI/Docker first if necessary; do not skip database testing.

- [ ] **Step 3: Implement the SQL migration.** Define `profiles(id uuid primary key references auth.users(id), email text not null, display_name text, timestamps)`; `financial_spaces(id uuid primary key default gen_random_uuid(), kind check (personal/shared), name, created_by references profiles, unique(created_by,kind))`; and `memberships(space_id, profile_id, role check (owner/admin/member), primary key(space_id,profile_id))`. Enable RLS on all three tables. Grant authenticated users select/update only on their own profile and select only through their own membership; grant no client insert policy.

- [ ] **Step 4: Add idempotent provisioning.** Create a `security definer` trigger function on `auth.users` that upserts the profile, inserts `('personal','Mis finanzas',new.id)` with `on conflict (created_by,kind)`, and inserts its `owner` membership with `on conflict do nothing`. Attach it as `after insert` on `auth.users`.

- [ ] **Step 5: Apply, verify and commit.**

Run: `npx supabase db reset --local; npx supabase test db --local --file supabase/tests/identity_security.sql`

Expected: all provisioning and cross-user RLS assertions pass.

Run: `git add supabase/migrations/20260821_identity_security.sql supabase/tests/identity_security.sql`

Run: `git commit -m "feat: provision secure personal financial spaces"`

### Task 3: Establish Supabase clients and server authorization

**Files:** Create `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/proxy.ts`, `src/lib/auth/session.ts`, `src/proxy.ts`, `tests/unit/auth-session.test.ts`.

**Interfaces:** `createBrowserClient()`, `createServerClient()`, `createRouteHandlerClient(request,response)`, `updateSession(request)`, `requireUser()`, `requireMembership(spaceId)`.

- [ ] **Step 1: Write failing unit tests.** Mock the server client to return user `user-a`; assert `requireMembership("space-a")` queries `memberships` by both `space_id` and `profile_id` and returns `{ spaceId: "space-a", role: "owner" }`. For null membership, assert `notFound()` is called.

- [ ] **Step 2: Run the test.**

Run: `corepack pnpm test tests/unit/auth-session.test.ts`

Expected: FAIL because the session module does not exist.

- [ ] **Step 3: Implement Supabase factories.** Browser factory uses `createBrowserClient` from `@supabase/ssr`. Server factory uses Next `cookies()` and copies refreshed cookies when permitted. Route Handler factory explicitly reads `request.cookies` and writes all session cookies to its supplied `NextResponse`. Proxy factory also copies every refreshed cookie from request to response.

- [ ] **Step 4: Implement authorization.** `requireUser` is `cache(async () => ...)`, calls `supabase.auth.getUser()`, redirects absent users to `/acceso`, and returns only `{id,email}`. `requireMembership` calls `requireUser`, selects `space_id,role` from `memberships` matching both current user and requested space, and calls `notFound()` when no row exists.

- [ ] **Step 5: Add the proxy.** `src/proxy.ts` exports named `proxy(request)` and matcher excluding `_next/static`, `_next/image`, `favicon.ico`, `sw.js` and `brand/`. It invokes `updateSession`. The helper calls `auth.getUser()`, redirects anonymous private routes to `/acceso?next=<safe full local path>`, and redirects authenticated visits to access/registration/recovery pages to `/resumen`.

- [ ] **Step 6: Verify and commit.**

Run: `corepack pnpm test tests/unit/auth-session.test.ts; corepack pnpm lint; corepack pnpm typecheck`

Expected: PASS. Proxy is explicitly not the only authorization layer.

Run: `git add src/lib/supabase src/lib/auth/session.ts src/proxy.ts tests/unit/auth-session.test.ts`

Run: `git commit -m "feat: add Supabase session and authorization boundary"`

### Task 4: Implement public self-service access

**Files:** Create `src/app/acceso/page.tsx`, `src/app/registro/page.tsx`, `src/app/recuperar-contrasena/page.tsx`, `src/app/auth/callback/route.ts`, `src/components/auth/sign-in-form.tsx`, `src/components/auth/sign-up-form.tsx`, `src/components/auth/password-recovery-form.tsx`, `tests/unit/auth-forms.test.tsx`. Modify `src/app/page.tsx`.

**Interfaces:** `SignInForm({next})`, `SignUpForm()`, `PasswordRecoveryForm()`. Callback exchanges a Supabase authorization `code` and redirects with `safeReturnPath`.

- [ ] **Step 1: Write failing accessible-form tests.** Mock browser Supabase. Fill `Correo electrónico` and `Contraseña` in `SignUpForm`, submit `Crear mi cuenta`, and expect `Revisa tu correo para activar tu cuenta.`. Test recovery always reports `Si existe una cuenta, recibirás instrucciones para recuperar el acceso.` regardless of mock result.

- [ ] **Step 2: Run focused tests.**

Run: `corepack pnpm test tests/unit/auth-forms.test.tsx`

Expected: FAIL because the forms do not exist.

- [ ] **Step 3: Implement registration and recovery.** Forms use native labels, client validation, pending state and generic errors. Signup calls `auth.signUp` with email/password and `emailRedirectTo` `${window.location.origin}/auth/callback?next=/resumen`; recovery calls `resetPasswordForEmail` with an internal redirect. Never distinguish an existing email in UI.

- [ ] **Step 4: Implement sign-in and OAuth.** Sign-in uses `signInWithPassword`, then returns to sanitized `next`. Google and Apple invoke `signInWithOAuth` with callback redirect, but render only under `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true"` and `NEXT_PUBLIC_APPLE_AUTH_ENABLED === "true"`. The callback Route Handler exchanges its `code` through `createRouteHandlerClient` before redirecting.

- [ ] **Step 5: Add public pages and landing actions.** Each page has the Spanish H1 `Iniciar sesión`, `Quiero ser cliente`, or `Recuperar contraseña`. Landing contains links with visible labels `Iniciar sesión` to `/acceso` and `Quiero ser cliente` to `/registro`.

- [ ] **Step 6: Verify and commit.**

Run: `corepack pnpm test tests/unit/auth-forms.test.tsx; corepack pnpm lint; corepack pnpm typecheck`

Expected: PASS without network, provider credentials or secrets in tests.

Run: `git add src/app src/components/auth src/lib/supabase tests/unit/auth-forms.test.tsx`

Run: `git commit -m "feat: add self-service account access"`

### Task 5: Protect the product UI, document setup and close the phase

**Files:** Create `src/app/(private)/layout.tsx`, `src/app/(private)/resumen/page.tsx`, `src/components/private-shell.tsx`, `src/components/sign-out-button.tsx`, `tests/unit/private-shell.test.tsx`, `tests/e2e/auth.spec.ts`, `docs/supabase-setup.md`. Move the current three placeholder pages into `src/app/(private)/`. Modify `src/lib/site.ts`, `tests/e2e/public-navigation.spec.ts`, `README.md`, `docs/implementation-phases.md`, `.github/workflows/ci.yml`.

**Interfaces:** `PrivateShell({email,children})`; private layout calls `requireUser`; `SignOutButton` invokes `auth.signOut` then returns to `/`.

- [ ] **Step 1: Write failing private-shell and anonymous E2E tests.** Unit-test email display, `/resumen` link and `Cerrar sesión`. Replace public navigation test with anonymous requests to `/perfil`, `/movimientos`, `/grupos`, expecting `/acceso?next=<encoded route>`. Add browser checks that landing reaches registration and anonymous profile shows access.

- [ ] **Step 2: Implement authenticated routes.** Private layout calls `requireUser` and wraps children in `PrivateShell`. Add `/resumen` with `requireUser` and Spanish ready-state copy. Move movements, groups and profile beneath `(private)` and remove their public `AppShell`. Change the Summary link to `/resumen`; `PrivateShell` shows email, internal nav and sign-out.

- [ ] **Step 3: Add test-safe browser auth setup.** E2E must intercept/mimic anonymous Supabase session behavior or use a server-only test adapter. Production and development must fail with an actionable missing-environment message rather than silently authenticating. E2E must never use actual email, Google or Apple credentials.

- [ ] **Step 4: Write deployment checklist.** `docs/supabase-setup.md` must state: create Supabase project and variables; apply migration; set localhost/production callback URLs; enable email confirmation and recovery templates; configure Google and Apple in Supabase dashboards; only then enable their public flags; manually prove signup, email confirmation, recovery, sign-out and two-user isolation. Link it from README.

- [ ] **Step 5: Run full verification.**

Run: `corepack pnpm lint; corepack pnpm typecheck; corepack pnpm test; corepack pnpm build; corepack pnpm test:e2e; npx supabase test db --local --file supabase/tests/identity_security.sql`

Expected: all commands exit 0. Fix every failure in its owning task.

- [ ] **Step 6: Close and commit.** Mark Phase 2 as `Completada` and append dated evidence in `docs/implementation-phases.md` naming Supabase Auth/PostgreSQL/RLS, automatic email activation, provider configuration gates and all verification commands.

Run: `git add src/app src/components src/lib/site.ts tests docs/supabase-setup.md README.md docs/implementation-phases.md .github/workflows/ci.yml`

Run: `git commit -m "feat: complete phase 2 identity and security"`

Expected: preserve untracked user work and generated `tsconfig.tsbuildinfo`.

## Plan Self-Review

- **Spec coverage:** Tasks 1–5 cover redirect safety, idempotent data provisioning/RLS, cookie sessions and server authorization, public signup/confirmation/OAuth/recovery, and protected product UI with configuration and proof.
- **Placeholder scan:** Every task has named files, an implementation boundary, a test and a command. Google/Apple credential entry remains manual because those are user-owned secrets, with an exact checklist.
- **Type consistency:** `safeReturnPath`, `requireUser`, `requireMembership`, `PrivateShell`, the client factories and all route names are used consistently across tasks.
