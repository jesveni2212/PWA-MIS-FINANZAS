# Next Development Origin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the local Playwright origin `127.0.0.1` to request Next.js development assets and make E2E finish cleanly.

**Architecture:** Keep the existing Playwright base URL and add one explicit development origin to the typed Next configuration. The test suite remains unchanged and validates the configuration through its existing browser flow.

**Tech Stack:** Next.js 16.3.1, TypeScript, Playwright.

## Global Constraints

- Add only `127.0.0.1` to `allowedDevOrigins`.
- Do not use wildcard domains or external origins.
- Do not modify `playwright.config.ts`, tests, Supabase configuration, or application routes.
- Confirm E2E exits with code 0 and no blocked-origin warning.

---

### Task 1: Allow the runner's local development origin

**Files:**
- Modify: `next.config.ts`
- Test: `tests/e2e/landing.spec.ts`, `tests/e2e/public-navigation.spec.ts`

**Interfaces:**
- Consumes: Playwright `baseURL` `http://127.0.0.1:3000`.
- Produces: `NextConfig.allowedDevOrigins` containing `"127.0.0.1"`.

- [ ] **Step 1: Inspect the existing typed configuration.**

Run: `Get-Content -Raw next.config.ts`

Expected: a `NextConfig` object is exported.

- [ ] **Step 2: Add the exact local origin.**

Replace the configuration object with:

```ts
const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
};
```

Expected: no other configuration field changes.

- [ ] **Step 3: Run E2E verification.**

Run: `corepack pnpm test:e2e`

Expected: all twelve tests pass, the process exits 0, and output has no `Blocked cross-origin request` warning.

- [ ] **Step 4: Run typecheck.**

Run: `corepack pnpm typecheck`

Expected: exit code 0.

- [ ] **Step 5: Commit the scoped fix.**

Run: `git add next.config.ts; git commit -m "test: allow Playwright development origin"`

Expected: one commit containing only `next.config.ts`.

## Plan Self-Review

- **Spec coverage:** the sole task adds the approved exact origin and confirms it using the existing E2E suite.
- **Placeholder scan:** paths, value, commands, and expected outcomes are explicit.
- **Consistency:** the origin value matches the unchanged Playwright base URL.
