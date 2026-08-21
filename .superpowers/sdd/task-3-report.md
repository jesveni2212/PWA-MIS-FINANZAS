# Task 3 — PWA installation and offline resilience

## Delivered

- Generated square `192×192` and `512×512` PNG icons in `public/brand/` from `LOGO.JPG`, preserving the source image unchanged.
- Added the Next App Router manifest route at `/manifest.webmanifest` with the agreed Spanish PWA metadata and icon references.
- Registered `/sw.js` once on client hydration through `PwaRegister()`.
- Added a minimal service worker that precaches the landing page, claims updates promptly, removes prior shell caches, and falls back to the cached landing page for failed navigations.
- Added desktop and iPhone Playwright projects plus landing/manifest smoke tests.

## TDD evidence

### RED

Command:

```powershell
corepack pnpm test tests/unit/pwa-register.test.tsx
```

Result: failed as expected because `@/components/pwa-register` did not exist.

### GREEN

Command:

```powershell
corepack pnpm test tests/unit/pwa-register.test.tsx
```

Result: passed — 1 test passed; `PwaRegister` registers `/sw.js`.

## Verification

| Check | Result |
| --- | --- |
| `corepack pnpm test tests/unit/pwa-register.test.tsx` | Passed (1/1) |
| `corepack pnpm typecheck` | Passed |
| `git diff --check` | Passed |
| `corepack pnpm test:e2e` | Blocked before tests: existing Next dev server PID 3340 owns the repository dev lock on port 3100, so the configured port-3000 server could not start. No unowned process was stopped. |

## Scope confirmation

No authentication, data capability, push delivery, dependency, health endpoint, or CI work was added.
