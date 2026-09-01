# Modern Phase 1 Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a modern, responsive and installable public PWA foundation for Mis Finanzas.

**Architecture:** Next.js App Router renders a static public shell from small, isolated components. A client-only registration component installs a minimal service worker, while route and manifest conventions provide health and installability without coupling the future financial domain to the UI.

**Tech Stack:** Next.js 16.3.1, React 19, TypeScript strict, Tailwind CSS 4, Vitest, Testing Library, Playwright, GitHub Actions and Vercel.

## Global Constraints

- Do not add authentication, a database, financial persistence, OCR, push delivery or groups in this phase.
- Preserve the root `LOGO.JPG`; only derived PNG files belong in `public/brand/`.
- Use Spanish copy, semantic landmarks, keyboard-usable navigation and mobile-first layouts.
- Do not add dependencies; the installed toolchain already covers this work.
- Do not commit secrets; only `.env.example` may document local configuration.
- Run lint, typecheck, unit tests, build and E2E tests before closing the phase.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `src/lib/site.ts` | Product copy and navigation labels. |
| `src/components/app-shell.tsx` | Accessible responsive shell, header and navigation. |
| `src/components/pwa-register.tsx` | Client-only service-worker registration. |
| `src/app/layout.tsx` | Global metadata, fonts, styles and PWA registration. |
| `src/app/page.tsx` | Modern public landing composition. |
| `src/app/globals.css` | Design tokens and shared base styles. |
| `src/app/manifest.ts` | PWA web manifest. |
| `public/sw.js` | Offline fallback for document navigation. |
| `src/app/api/health/route.ts` | Deployment health response. |
| `tests/unit/*.test.tsx` | Shell, registration and route confidence. |
| `tests/e2e/landing.spec.ts` | Desktop and iPhone public smoke coverage. |
| `.github/workflows/ci.yml`, `vercel.json` | Automated verification and deployment defaults. |

### Task 1: Verify the baseline quality toolchain

**Files:**
- Create: none.
- Modify: none unless a command exposes an existing configuration error.
- Test: `tests/unit/toolchain.test.ts`.

**Interfaces:**
- Consumes: existing `package.json` scripts and `vitest.config.ts`.
- Produces: a verified baseline before product code is edited.

- [ ] **Step 1: Inspect the initial test and configuration**

Run: `Get-Content -Raw tests/unit/toolchain.test.ts; Get-Content -Raw vitest.config.ts; Get-Content -Raw package.json`

Expected: the test expects `true` to equal `true`, Vitest uses jsdom and the five quality scripts are present.

- [ ] **Step 2: Run the baseline test**

Run: `corepack pnpm test tests/unit/toolchain.test.ts`

Expected: PASS with one test.

- [ ] **Step 3: Run static baseline checks**

Run: `corepack pnpm lint; corepack pnpm typecheck`

Expected: both commands exit with code 0.

- [ ] **Step 4: Commit the verified initial repository**

Run:

```powershell
git add .env.example .gitignore AGENTS.md CLAUDE.md CODEX.md LOGO.JPG README.md docs/implementation-phases.md docs/project-master.md docs/superpowers/specs/2026-08-19-mis-finanzas-design.md eslint.config.mjs next-env.d.ts next.config.ts package.json playwright.config.ts pnpm-lock.yaml pnpm-workspace.yaml postcss.config.mjs public src tests tsconfig.json tsconfig.tsbuildinfo vitest.config.ts
git commit -m "chore: initialize Next.js quality toolchain"
```

Expected: the repository baseline is committed without secrets.

### Task 2: Build the modern responsive public shell

**Files:**
- Create: `src/lib/site.ts`, `src/components/app-shell.tsx`, `tests/unit/app-shell.test.tsx`.
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`.
- Test: `tests/unit/app-shell.test.tsx`.

**Interfaces:**
- Consumes: `site` from `@/lib/site`.
- Produces: `AppShell({ children }: { children: ReactNode }): ReactElement`.

- [ ] **Step 1: Write the failing shell test**

Create `tests/unit/app-shell.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/app-shell";

describe("AppShell", () => {
  it("exposes product navigation and its content", () => {
    render(
      <AppShell>
        <p>Contenido de prueba</p>
      </AppShell>,
    );

    expect(screen.getByText("Mis Finanzas")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Navegación principal" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Contenido de prueba")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `corepack pnpm test tests/unit/app-shell.test.tsx`

Expected: FAIL because `@/components/app-shell` does not exist.

- [ ] **Step 3: Add product copy and the shell component**

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

type AppShellProps = { children: ReactNode };

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/80 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <span className="text-lg font-bold tracking-tight">{site.name}</span>
          <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
            Próximamente
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 py-8 pb-28 sm:px-8 sm:pb-10">
        {children}
      </main>
      <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 border-t border-border/80 bg-surface/95 px-3 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:static sm:mx-auto sm:max-w-6xl sm:border-x">
        <ul className="grid grid-cols-4 py-2">
          {site.navigation.map((item) => (
            <li className="py-2 text-center text-xs font-medium text-muted" key={item}>
              {item}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
```

- [ ] **Step 4: Replace the root layout and landing page**

Replace `src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mis Finanzas",
  description: "Tus finanzas personales y compartidas, claras y bajo control.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
```

Replace `src/app/page.tsx` with:

```tsx
import { AppShell } from "@/components/app-shell";

export default function HomePage() {
  return (
    <AppShell>
      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand via-brand to-brand-bright p-7 text-brand-foreground shadow-xl shadow-brand/20 sm:p-12">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-foreground/75">PWA de finanzas</p>
        <h1 className="mt-5 max-w-2xl text-4xl font-bold tracking-tight sm:text-6xl">Una base clara para tus finanzas.</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-brand-foreground/85 sm:text-lg">Pronto podrás gestionar cuentas, gastos y grupos desde cualquier dispositivo.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl bg-white/12 p-4 ring-1 ring-white/20"><p className="text-xs text-brand-foreground/70">Visión mensual</p><p className="mt-2 font-semibold">Todo en contexto</p></article>
          <article className="rounded-2xl bg-white/12 p-4 ring-1 ring-white/20"><p className="text-xs text-brand-foreground/70">Movimientos</p><p className="mt-2 font-semibold">Registro simple</p></article>
          <article className="rounded-2xl bg-white/12 p-4 ring-1 ring-white/20"><p className="text-xs text-brand-foreground/70">Grupos</p><p className="mt-2 font-semibold">Cuentas claras</p></article>
        </div>
      </section>
    </AppShell>
  );
}
```

- [ ] **Step 5: Replace global styles with the design tokens**

Replace `src/app/globals.css` with:

```css
@import "tailwindcss";

:root { --background: #f4f8f6; --foreground: #14211d; --surface: #ffffff; --border: #d8e4df; --muted: #64746e; --brand: #087e6b; --brand-bright: #12a78c; --brand-soft: #dff8f0; --brand-foreground: #f6fffc; }
@theme inline { --color-background: var(--background); --color-foreground: var(--foreground); --color-surface: var(--surface); --color-border: var(--border); --color-muted: var(--muted); --color-brand: var(--brand); --color-brand-bright: var(--brand-bright); --color-brand-soft: var(--brand-soft); --color-brand-foreground: var(--brand-foreground); --font-sans: var(--font-geist-sans); --font-mono: var(--font-geist-mono); }
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; background: var(--background); color: var(--foreground); font-family: Arial, Helvetica, sans-serif; }
```

- [ ] **Step 6: Run focused and static checks**

Run: `corepack pnpm test tests/unit/app-shell.test.tsx; corepack pnpm lint; corepack pnpm typecheck`

Expected: all commands pass.

- [ ] **Step 7: Commit the shell**

Run:

```powershell
git add src/app/globals.css src/app/layout.tsx src/app/page.tsx src/components/app-shell.tsx src/lib/site.ts tests/unit/app-shell.test.tsx
git commit -m "feat: add modern responsive product shell"
```

Expected: the public shell is committed with its regression test.

### Task 3: Add PWA installation and offline resilience

**Files:**
- Create: `src/components/pwa-register.tsx`, `src/app/manifest.ts`, `public/sw.js`, `public/brand/logo-192.png`, `public/brand/logo-512.png`, `tests/unit/pwa-register.test.tsx`, `tests/e2e/landing.spec.ts`.
- Modify: `src/app/layout.tsx`, `playwright.config.ts`.
- Test: `tests/unit/pwa-register.test.tsx`, `tests/e2e/landing.spec.ts`.

**Interfaces:**
- Produces: `PwaRegister(): null` and `GET /manifest.webmanifest`.

- [ ] **Step 1: Produce derivative icons without altering the source**

Run:

```powershell
New-Item -ItemType Directory -Force public/brand
Add-Type -AssemblyName System.Drawing
$source = [System.Drawing.Image]::FromFile((Resolve-Path LOGO.JPG))
foreach ($size in 192, 512) {
  $canvas = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  $graphics.Clear([System.Drawing.Color]::White)
  $scale = [Math]::Min($size / $source.Width, $size / $source.Height)
  $width = [int]($source.Width * $scale); $height = [int]($source.Height * $scale)
  $graphics.DrawImage($source, [int](($size - $width) / 2), [int](($size - $height) / 2), $width, $height)
  $canvas.Save((Join-Path (Resolve-Path public/brand) "logo-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $canvas.Dispose()
}
$source.Dispose()
```

Expected: `LOGO.JPG` remains unchanged and both square PNG files exist.

- [ ] **Step 2: Write the failing registration test**

Create `tests/unit/pwa-register.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PwaRegister } from "@/components/pwa-register";

describe("PwaRegister", () => {
  it("registers the worker", () => {
    const register = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register } });
    render(<PwaRegister />);
    expect(register).toHaveBeenCalledWith("/sw.js");
  });
});
```

- [ ] **Step 3: Run the registration test to verify it fails**

Run: `corepack pnpm test tests/unit/pwa-register.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 4: Implement registration, manifest and offline worker**

Create `src/components/pwa-register.tsx`:

```tsx
"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
  }, []);
  return null;
}
```

Create `src/app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "Mis Finanzas", short_name: "Finanzas", start_url: "/", display: "standalone", background_color: "#f4f8f6", theme_color: "#087e6b", lang: "es", icons: [{ src: "/brand/logo-192.png", sizes: "192x192", type: "image/png" }, { src: "/brand/logo-512.png", sizes: "512x512", type: "image/png" }] };
}
```

Create `public/sw.js`:

```js
const CACHE = "mis-finanzas-shell-v1";
self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE).then((cache) => cache.add("/"))); self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))); self.clients.claim(); });
self.addEventListener("fetch", (event) => { if (event.request.method === "GET" && event.request.mode === "navigate") event.respondWith(fetch(event.request).catch(() => caches.match("/"))); });
```

Add `import { PwaRegister } from "@/components/pwa-register";` to `src/app/layout.tsx`, then replace `<body className="min-h-full">{children}</body>` with `<body className="min-h-full"><PwaRegister />{children}</body>`.

- [ ] **Step 5: Add browser smoke coverage**

Replace `playwright.config.ts` with:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({ testDir: "./tests/e2e", use: { baseURL: "http://127.0.0.1:3000" }, webServer: { command: "corepack pnpm dev", url: "http://127.0.0.1:3000", reuseExistingServer: !process.env.CI }, projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }, { name: "iphone", use: { ...devices["iPhone 13"] } }] });
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

- [ ] **Step 6: Run PWA checks**

Run: `corepack pnpm test tests/unit/pwa-register.test.tsx; corepack pnpm test:e2e`

Expected: the unit test passes; both E2E tests pass in desktop and iPhone emulation.

- [ ] **Step 7: Commit the installable PWA**

Run:

```powershell
git add src/app/layout.tsx src/app/manifest.ts src/components/pwa-register.tsx public/sw.js public/brand/logo-192.png public/brand/logo-512.png playwright.config.ts tests/unit/pwa-register.test.tsx tests/e2e/landing.spec.ts
git commit -m "feat: add installable PWA foundation"
```

Expected: PWA assets, registration and smoke coverage are committed.

### Task 4: Provide health verification and deployment readiness

**Files:**
- Create: `src/app/api/health/route.ts`, `tests/unit/health.test.ts`, `.github/workflows/ci.yml`, `vercel.json`.
- Modify: `README.md`.
- Test: `tests/unit/health.test.ts`.

**Interfaces:**
- Produces: `GET(): Response` with status 200 and JSON `{ status: "ok" }`.

- [ ] **Step 1: Write the failing health test**

Create `tests/unit/health.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns status ok", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `corepack pnpm test tests/unit/health.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the health route**

Create `src/app/api/health/route.ts`:

```ts
export function GET() {
  return Response.json({ status: "ok" }, { status: 200 });
}
```

- [ ] **Step 4: Configure Vercel and GitHub Actions**

Create `vercel.json`:

```json
{ "$schema": "https://openapi.vercel.sh/vercel.json", "framework": "nextjs" }
```

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

- [ ] **Step 5: Replace the README with local and cloud instructions**

Replace `README.md` with:

```markdown
# Mis Finanzas

PWA privada para finanzas personales y compartidas.

## Desarrollo local

```powershell
Copy-Item .env.example .env.local
corepack pnpm dev
```

Abre `http://localhost:3000` y consulta `http://localhost:3000/api/health`.

## Verificación

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm test:e2e
```

## Despliegue

1. Crea un repositorio privado en GitHub y agrega el remoto.
2. Importa el repositorio en Vercel.
3. Define `NEXT_PUBLIC_APP_URL` en Vercel.
4. Conecta el dominio y configura los DNS solicitados por Vercel.
```

- [ ] **Step 6: Run endpoint and deployment checks**

Run: `corepack pnpm test tests/unit/health.test.ts; corepack pnpm lint; corepack pnpm typecheck; corepack pnpm build`

Expected: all commands exit with code 0.

- [ ] **Step 7: Commit deployment readiness**

Run:

```powershell
git add .github/workflows/ci.yml README.md src/app/api/health/route.ts tests/unit/health.test.ts vercel.json
git commit -m "ci: add deployment and health verification"
```

Expected: CI, deployment config, documentation and health route are committed.

### Task 5: Close Phase 1 with full verification

**Files:**
- Modify: `docs/implementation-phases.md`.
- Test: full quality gate and Git status.

**Interfaces:**
- Consumes: the completed tasks 1 through 4.
- Produces: auditable completion evidence for Phase 2 planning.

- [ ] **Step 1: Run the complete quality gate**

Run: `corepack pnpm lint; corepack pnpm typecheck; corepack pnpm test; corepack pnpm build; corepack pnpm test:e2e`

Expected: every command exits with code 0.

- [ ] **Step 2: Record the actual closure evidence**

In `docs/implementation-phases.md`, change the Phase 1 row state from `Pendiente` to `Completada`. Append this section using the actual date:

```markdown
### Fase 1 — 2026-08-20

- Entregado: Next.js PWA responsive con shell moderno, manifest, service worker, salud HTTP, pruebas y CI.
- Verificado: `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build`, `corepack pnpm test:e2e`.
- Resultado: todos los comandos finalizaron con código 0.
- Decisiones: Vercel administra el despliegue; aún no existen autenticación ni persistencia financiera.
- Próximo paso: diseñar y planificar la Fase 2 — identidad y seguridad.
```

- [ ] **Step 3: Commit the phase closure and inspect the tree**

Run:

```powershell
git add docs/implementation-phases.md
git commit -m "docs: close phase 1 foundations"
git status --short
```

Expected: `git status --short` prints no files.

## Plan Self-Review

- **Spec coverage:** Task 2 implements the approved modern visual direction, mobile-first shell and accessibility landmarks; Task 3 covers manifest, icons, worker and offline resilience; Task 4 covers health, CI, Vercel and documentation; Task 5 records the required evidence.
- **Placeholder scan:** the plan contains no TBD, TODO, deferred implementation directions or undefined code steps.
- **Type consistency:** `AppShell`, `PwaRegister` and `GET` use the same names and contracts in tests and implementations throughout.
