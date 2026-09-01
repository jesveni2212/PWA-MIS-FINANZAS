# Phase 1: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or an execution-plan workflow to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a secure, testable, responsive, installable Next.js PWA foundation that deploys automatically from private GitHub to Vercel.

**Architecture:** TypeScript modular monolith. Next.js App Router provides UI and thin HTTP endpoints; future domain modules remain independent from UI and providers. This phase has no authentication or financial persistence.

**Tech Stack:** Node.js 22 LTS, pnpm, Next.js App Router, React, TypeScript strict, Tailwind CSS, Vitest, Testing Library, Playwright, GitHub Actions, Vercel.

## Global Constraints

- Repository must be private when published to GitHub.
- Use TypeScript `strict: true`; no `any`.
- Mobile-first UI; Spanish copy; accessible semantic landmarks.
- Do not add database, Auth.js, OCR, push delivery, payment provider, or financial data in this phase.
- Preserve `LOGO.JPG`; use only a derivative in `public/brand/`.
- Never commit secrets; commit only `.env.example`.
- Close the phase only after lint, typecheck, unit tests, build and E2E smoke pass.
- Update `docs/implementation-phases.md` at closure.

## File Structure

| Path | Responsibility |
| --- | --- |
| `.gitignore`, `.env.example` | Protect artifacts and document safe configuration. |
| `src/app/layout.tsx`, `page.tsx`, `globals.css` | Root metadata and responsive public shell. |
| `src/app/manifest.ts`, `public/sw.js` | Installability and safe offline fallback. |
| `src/components/app-shell.tsx` | Shared semantic navigation frame. |
| `src/components/pwa-register.tsx` | Client-only service-worker registration. |
| `src/lib/site.ts` | One source for product copy and navigation. |
| `src/app/api/health/route.ts` | Deployment health endpoint. |
| `tests/unit/*.test.tsx`, `tests/e2e/landing.spec.ts` | Unit and browser confidence. |
| `.github/workflows/ci.yml`, `vercel.json` | Automated quality gate and deployment defaults. |

## Task 1: Initialize repository and quality toolchain

**Files:**
- Create: `.gitignore`, `.env.example`, `vitest.config.ts`, `tests/setup.ts`, `tests/unit/toolchain.test.ts`, `playwright.config.ts`, `README.md`
- Modify: `package.json`
- Test: `tests/unit/toolchain.test.ts`

**Interfaces:**
- Produces scripts: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`.

- [ ] **Step 1: Create the local repository and Next.js project**

Run:

```powershell
git init
git branch -M main
corepack enable
pnpm create next-app@latest phase-1-seed --ts --tailwind --eslint --app --src-dir --use-pnpm --import-alias "@/*" --yes
Get-ChildItem -Force phase-1-seed | Move-Item -Destination .
Remove-Item phase-1-seed
```

Expected: `.git/`, `package.json`, and `src/app/` exist while the pre-existing `LOGO.JPG` remains untouched. Do not add a GitHub remote yet.

- [ ] **Step 2: Add tests and scripts**

Run:

```powershell
pnpm add -D vitest jsdom @testing-library/react @testing-library/jest-dom @playwright/test
pnpm exec playwright install chromium
```

Set `package.json` scripts exactly:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:e2e": "playwright test"
}
```

- [ ] **Step 3: Write and run the initial failing unit test**

Create `tests/unit/toolchain.test.ts`:

```ts
import { describe, expect, it } from "vitest";
describe("toolchain", () => it("runs tests", () => expect(true).toBe(true)));
```

Run: `pnpm test`  
Expected: FAIL because Vitest configuration is absent.

- [ ] **Step 4: Configure Vitest, then rerun the test**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "jsdom", setupFiles: ["./tests/setup.ts"], include: ["tests/unit/**/*.test.{ts,tsx}"] },
});
```

Create `tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Run: `pnpm test`  
Expected: PASS with one test.

- [ ] **Step 5: Protect local secrets and artifacts**

Create `.gitignore`:

```gitignore
node_modules/
.next/
coverage/
playwright-report/
test-results/
.env
.env.local
.env.*.local
!.env.example
```

Create `.env.example`:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 6: Commit the checkpoint**

```powershell
git add .
git commit -m "chore: initialize Next.js quality toolchain"
```

Expected: clean tree.

## Task 2: Implement the responsive product shell

**Files:**
- Create: `src/lib/site.ts`, `src/components/app-shell.tsx`, `tests/unit/app-shell.test.tsx`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Test: `tests/unit/app-shell.test.tsx`

**Interfaces:**
- Produces: `AppShell({ children }: { children: ReactNode })`.

- [ ] **Step 1: Write the failing component test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/app-shell";
describe("AppShell", () => it("exposes product navigation", () => {
  render(<AppShell><p>Contenido</p></AppShell>);
  expect(screen.getByText("Mis Finanzas")).toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeInTheDocument();
}));
```

Run: `pnpm test tests/unit/app-shell.test.tsx`  
Expected: FAIL because `AppShell` does not exist.

- [ ] **Step 2: Create metadata and component contracts**

Create `src/lib/site.ts`:

```ts
export const site = {
  name: "Mis Finanzas",
  description: "Tus finanzas personales y compartidas, claras y bajo control.",
  navigation: ["Resumen", "Movimientos", "Grupos", "Perfil"],
} as const;
```

Create `src/components/app-shell.tsx`:

```tsx
import type { ReactNode } from "react";
import { site } from "@/lib/site";
export function AppShell({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-background text-foreground">
    <header className="border-b border-border bg-surface"><div className="mx-auto flex max-w-6xl justify-between px-4 py-4"><span className="font-semibold">{site.name}</span><span className="text-sm text-muted">Próximamente</span></div></header>
    <main className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:pb-8">{children}</main>
    <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 border-t border-border bg-surface sm:static"><ul className="grid grid-cols-4 py-2">{site.navigation.map((item) => <li className="text-center text-xs text-muted" key={item}>{item}</li>)}</ul></nav>
  </div>;
}
```

Run: `pnpm test tests/unit/app-shell.test.tsx`  
Expected: PASS.

- [ ] **Step 3: Add the landing page and design tokens**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Mis Finanzas", description: "Tus finanzas personales y compartidas, claras y bajo control." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
```

Replace `src/app/page.tsx`:

```tsx
import { AppShell } from "@/components/app-shell";
export default function HomePage() {
  return <AppShell><section className="grid gap-6 rounded-3xl bg-brand p-6 text-brand-foreground sm:p-10"><p className="text-sm uppercase tracking-widest">PWA de finanzas</p><h1 className="text-4xl font-semibold sm:text-5xl">Una base clara para tus finanzas.</h1><p>Pronto podrás gestionar cuentas, gastos y grupos desde cualquier dispositivo.</p></section></AppShell>;
}
```

Append this token block to `src/app/globals.css`:

```css
:root { --background:#f7faf9; --foreground:#17221f; --surface:#fff; --border:#d9e3df; --muted:#61716b; --brand:#0f766e; --brand-foreground:#f8fffd; }
@theme inline { --color-background:var(--background); --color-foreground:var(--foreground); --color-surface:var(--surface); --color-border:var(--border); --color-muted:var(--muted); --color-brand:var(--brand); --color-brand-foreground:var(--brand-foreground); }
body { margin:0; min-width:320px; background:var(--background); color:var(--foreground); }
```

- [ ] **Step 4: Verify and commit**

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git add src tests package.json pnpm-lock.yaml
git commit -m "feat: add responsive product shell"
```

Expected: every verification command exits 0.

## Task 3: Implement PWA installability

**Files:**
- Create: `src/app/manifest.ts`, `src/components/pwa-register.tsx`, `public/sw.js`, `public/brand/logo-192.png`, `public/brand/logo-512.png`, `tests/unit/pwa-register.test.tsx`, `tests/e2e/landing.spec.ts`
- Modify: `src/app/layout.tsx`, `playwright.config.ts`
- Test: registration and two browser viewports.

**Interfaces:**
- Produces: `PwaRegister()`, `/manifest.webmanifest`, and offline fallback to `/`.

- [ ] **Step 1: Create PWA icons without modifying the source logo**

Create `public/brand/`. Use an image editor to derive square `logo-192.png` (192×192) and `logo-512.png` (512×512) from `LOGO.JPG`, retaining the original root file unchanged. Verify both are valid PNGs.

- [ ] **Step 2: Write the failing worker-registration test**

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PwaRegister } from "@/components/pwa-register";
describe("PwaRegister", () => it("registers the worker", () => {
  const register = vi.fn();
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register } });
  render(<PwaRegister />);
  expect(register).toHaveBeenCalledWith("/sw.js");
}));
```

Run: `pnpm test tests/unit/pwa-register.test.tsx`  
Expected: FAIL because component is absent.

- [ ] **Step 3: Implement registration, manifest and worker**

Create `src/components/pwa-register.tsx`:

```tsx
"use client";
import { useEffect } from "react";
export function PwaRegister() {
  useEffect(() => { if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js"); }, []);
  return null;
}
```

Create `src/app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name:"Mis Finanzas", short_name:"Finanzas", start_url:"/", display:"standalone", background_color:"#f7faf9", theme_color:"#0f766e", lang:"es", icons:[{src:"/brand/logo-192.png",sizes:"192x192",type:"image/png"},{src:"/brand/logo-512.png",sizes:"512x512",type:"image/png"}] };
}
```

Create `public/sw.js`:

```js
const CACHE = "mis-finanzas-shell-v1";
self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE).then((cache) => cache.add("/"))); self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))); self.clients.claim(); });
self.addEventListener("fetch", (event) => { if (event.request.method === "GET") event.respondWith(fetch(event.request).catch(() => caches.match("/"))); });
```

Import `PwaRegister` in the root layout and render `<PwaRegister />` as first child of `body`.

Run: `pnpm test tests/unit/pwa-register.test.tsx`  
Expected: PASS.

- [ ] **Step 4: Add browser smoke coverage**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({ testDir:"./tests/e2e", use:{baseURL:"http://127.0.0.1:3000"}, webServer:{command:"pnpm dev",url:"http://127.0.0.1:3000",reuseExistingServer:!process.env.CI}, projects:[{name:"desktop",use:{...devices["Desktop Chrome"]}},{name:"iphone",use:{...devices["iPhone 13"]}}] });
```

Create `tests/e2e/landing.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
test("renders the public shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Una base clara para tus finanzas." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();
});
test("serves the PWA manifest", async ({ page }) => {
  const response = await page.goto("/manifest.webmanifest");
  expect(response?.ok()).toBe(true);
});
```

Run: `pnpm test:e2e`  
Expected: four passing checks (two tests in desktop and iPhone emulation).

- [ ] **Step 5: Commit**

```powershell
git add src public tests playwright.config.ts package.json pnpm-lock.yaml
git commit -m "feat: add installable PWA foundation"
```

## Task 4: Add health endpoint, CI and Vercel readiness

**Files:**
- Create: `src/app/api/health/route.ts`, `tests/unit/health.test.ts`, `.github/workflows/ci.yml`, `vercel.json`
- Modify: `README.md`
- Test: `tests/unit/health.test.ts`

**Interfaces:**
- Produces: `GET /api/health -> 200 { status: "ok" }`.

- [ ] **Step 1: Write the failing health test**

```ts
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";
describe("GET /api/health", () => it("returns status ok", async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ status: "ok" });
}));
```

Run: `pnpm test tests/unit/health.test.ts`  
Expected: FAIL because route is absent.

- [ ] **Step 2: Implement endpoint and Vercel defaults**

Create `src/app/api/health/route.ts`:

```ts
export function GET() { return Response.json({ status: "ok" }, { status: 200 }); }
```

Create `vercel.json`:

```json
{ "$schema": "https://openapi.vercel.sh/vercel.json", "framework": "nextjs" }
```

Run: `pnpm test tests/unit/health.test.ts`  
Expected: PASS.

- [ ] **Step 3: Add CI exactly matching local core checks**

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 4: Document local and cloud workflow**

Set `README.md` to explain:

```markdown
# Mis Finanzas

## Desarrollo local
```powershell
corepack enable
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

Consulta `http://localhost:3000/api/health`.

## Verificación
```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## Despliegue
1. Crea un repositorio privado en GitHub y agrega el remoto.
2. Importa el repositorio en Vercel.
3. Define `NEXT_PUBLIC_APP_URL`.
4. Conecta el dominio y configura los registros DNS indicados por Vercel.
```

- [ ] **Step 5: Verify and commit**

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
git add .github src README.md vercel.json tests
git commit -m "ci: add deployment and health verification"
```

Expected: all checks pass and the commit contains endpoint, CI and documentation.

## Task 5: Close Phase 1 documentation

**Files:**
- Modify: `docs/implementation-phases.md`
- Test: full quality gate plus Git status.

**Interfaces:**
- Consumes: successful outputs from Tasks 1–4.
- Produces: auditable phase closure for Phase 2 planning.

- [ ] **Step 1: Record actual completion evidence**

Only after all checks pass, set Fase 1 to `Completada` and add:

```markdown
### Fase 1 — YYYY-MM-DD

- Entregado: Next.js PWA responsive, manifest, service worker, salud HTTP, pruebas y CI.
- Verificado: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`.
- Resultado: todos los comandos finalizaron con código 0.
- Decisiones: Vercel administra el despliegue; aún no existen autenticación ni persistencia financiera.
- Próximo paso: diseñar y planificar Fase 2 — identidad y seguridad.
```

- [ ] **Step 2: Final verification and commit**

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
git add docs/implementation-phases.md
git commit -m "docs: close phase 1 foundations"
git status --short
```

Expected: all checks exit 0 and `git status --short` prints no files.

## Plan self-review

- **Spec coverage:** covers private-repository preparation, responsive PWA shell, original-logo preservation, manifest, service worker, health check, CI, Vercel readiness and phase documentation. It deliberately excludes later approved domains: identity, PostgreSQL, finances, OCR, push and groups.
- **Placeholder scan:** tasks contain exact paths, runnable commands, interfaces, tests and expected results. `YYYY-MM-DD` is the real completion date recorded at execution, not an unfinished product choice.
- **Consistency:** `AppShell`, `PwaRegister`, `GET`, test paths and scripts use identical names across all tasks.
