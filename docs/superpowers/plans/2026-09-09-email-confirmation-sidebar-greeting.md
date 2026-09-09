# Email Confirmation and Sidebar Greeting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar una pantalla centrada despues de confirmar el correo y un saludo compacto en el panel autenticado, usando el nombre del perfil o `Bienvenido/a` como fallback.

**Architecture:** El registro enviara el enlace a `/auth/callback?next=/registro-confirmado`. El callback intercambiara el codigo PKCE y redirigira a una pagina publica de confirmacion con estado de exito o error, mientras que los destinos existentes de recuperacion de contrasena conservaran su comportamiento. `AppShell` consultara el `display_name` del perfil desde el cliente Supabase ya existente y renderizara el saludo en la zona inferior del menu lateral, con una variante para la cabecera movil.

**Tech Stack:** Next.js 16.3.1 App Router, React 19, TypeScript, Tailwind CSS 4, `@supabase/ssr`, Supabase Auth, Vitest, Testing Library y Playwright.

## Global Constraints

- Usar las convenciones de Next.js 16.3.1 del repositorio: `src/proxy.ts`, Route Handlers en `route.ts` y `searchParams` como `Promise` en paginas asincronas.
- La pantalla `/registro-confirmado` no mostrara saludo ni nombre.
- El panel usara `profiles.display_name` cuando exista y mostrara `Bienvenido/a` cuando este vacio, ausente o no disponible.
- No usar la parte local del correo como fallback visual.
- No pedir nombre de usuario durante el registro.
- No modificar claves, migraciones, politicas RLS, menus ni la logica de ocultar saldos.
- No introducir claves secretas ni valores de Supabase en el codigo fuente.
- El destino del callback debe ser interno y seguir protegido por `safeReturnPath`.
- Ejecutar las pruebas Vitest serializadas con `--pool=forks --maxWorkers=1` para evitar los timeouts conocidos del worker paralelo.

---

## File Map

- Modify `src/lib/auth/paths.ts`: publicar la constante de la ruta de confirmacion sin convertirla en ruta privada.
- Modify `src/app/auth/callback/route.ts`: distinguir el flujo de confirmacion y comunicar estados de exito/error sin afectar recuperacion de contrasena.
- Modify `tests/unit/auth-paths.test.ts` and `tests/unit/auth-callback.test.ts`: fijar los contratos de ruta y callback.
- Create `src/components/auth/registration-confirmation-card.tsx`: presentar los estados visuales centrados de confirmacion.
- Create `src/app/registro-confirmado/page.tsx`: convertir el query param `estado` en el estado de la tarjeta.
- Create `tests/unit/registration-confirmation-card.test.tsx`: verificar copia, CTA y ausencia de saludo.
- Create `src/lib/auth/redirects.ts`: construir los destinos internos usados por el registro.
- Modify `src/components/auth/sign-up-form.tsx`: enviar `emailRedirectTo` y navegar a la confirmacion cuando exista sesion inmediata.
- Create `tests/unit/auth-redirects.test.ts` and `tests/unit/sign-up-form.test.tsx`: probar el destino PKCE y el payload de `signUp`.
- Create `src/lib/auth/greeting.ts`: normalizar el nombre y producir el texto visible del saludo.
- Modify `src/components/app-shell.tsx`: cargar el perfil y ubicar el saludo compacto en escritorio y movil.
- Create `tests/unit/greeting.test.ts` and `tests/unit/app-shell.test.tsx`: probar fallback, nombre de perfil y render del panel.

## Task 1: Route the email-confirmation callback

**Files:**
- Modify: `src/lib/auth/paths.ts`
- Modify: `src/app/auth/callback/route.ts`
- Test: `tests/unit/auth-paths.test.ts`
- Test: `tests/unit/auth-callback.test.ts`

**Interfaces:**
- Produces `registrationConfirmationPath: "/registro-confirmado"` for the registration form and callback.
- Keeps `GET(request: Request)` as the callback entry point.
- The callback emits `/registro-confirmado?estado=exitoso` only after `exchangeCodeForSession` returns without an error, and emits `/registro-confirmado?estado=error` for a missing or failed confirmation code.

- [ ] **Step 1: Write the failing route-contract tests**

Add the constant import and assertions below to `tests/unit/auth-paths.test.ts`:

```ts
import {
  authPaths,
  isPrivatePath,
  privatePaths,
  registrationConfirmationPath,
  safeReturnPath,
} from "@/lib/auth/paths";

it("keeps the registration confirmation route public and safe", () => {
  expect(registrationConfirmationPath).toBe("/registro-confirmado");
  expect(isPrivatePath(registrationConfirmationPath)).toBe(false);
  expect(safeReturnPath(registrationConfirmationPath)).toBe(registrationConfirmationPath);
});
```

Replace `tests/unit/auth-callback.test.ts` with this complete test file so the existing safe redirects and the new confirmation states are covered:

```ts
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, exchangeCodeForSession } = vi.hoisted(() => ({
  createClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));

describe("authentication callback", () => {
  beforeEach(() => {
    createClient.mockReset();
    exchangeCodeForSession.mockReset();
    createClient.mockResolvedValue({ auth: { exchangeCodeForSession } });
    exchangeCodeForSession.mockResolvedValue({ error: null });
    vi.resetModules();
  });

  it("exchanges a PKCE code and redirects to a safe internal path", async () => {
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new NextRequest("https://app.test/auth/callback?code=pkce-code&next=%2Fperfil"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
    expect(response.headers.get("location")).toBe("https://app.test/perfil");
  });

  it("redirects a successful registration confirmation to the success screen", async () => {
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new NextRequest("https://app.test/auth/callback?code=confirmation-code&next=%2Fregistro-confirmado"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("confirmation-code");
    expect(response.headers.get("location")).toBe("https://app.test/registro-confirmado?estado=exitoso");
  });

  it("shows a controlled error screen for a missing confirmation code", async () => {
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new NextRequest("https://app.test/auth/callback?next=%2Fregistro-confirmado"));

    expect(createClient).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://app.test/registro-confirmado?estado=error");
  });

  it("shows a controlled error screen when Supabase rejects the confirmation code", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "invalid code" } });
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new NextRequest("https://app.test/auth/callback?code=invalid&next=%2Fregistro-confirmado"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("invalid");
    expect(response.headers.get("location")).toBe("https://app.test/registro-confirmado?estado=error");
  });

  it("does not exchange a missing code or redirect an external next value", async () => {
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new NextRequest("https://app.test/auth/callback?next=https%3A%2F%2Fevil.test"));

    expect(createClient).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://app.test/");
  });

  it("keeps auth paths and failed exchanges on a safe redirect", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "invalid code" } });
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new NextRequest("https://app.test/auth/callback?code=invalid&next=%2Facceso"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("invalid");
    expect(response.headers.get("location")).toBe("https://app.test/");
  });
});
```

- [ ] **Step 2: Run the callback tests and verify the new cases fail**

Run:

```bash
corepack pnpm test tests/unit/auth-paths.test.ts tests/unit/auth-callback.test.ts --pool=forks --maxWorkers=1
```

Expected: the existing tests pass, while the new route assertion and confirmation redirect tests fail because the constant and status redirect do not exist yet.

- [ ] **Step 3: Implement the public path and callback state handling**

Add this export to `src/lib/auth/paths.ts` above `privatePaths`:

```ts
export const registrationConfirmationPath = "/registro-confirmado" as const;
```

Replace `src/app/auth/callback/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { registrationConfirmationPath, safeReturnPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const returnPath = safeReturnPath(requestUrl.searchParams.get("next"));
  const returnUrl = new URL(returnPath, requestUrl.origin);
  const isRegistrationConfirmation = returnUrl.pathname === registrationConfirmationPath;
  let exchangeSucceeded = false;

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      exchangeSucceeded = !error;
    } catch {
      exchangeSucceeded = false;
    }
  }

  if (isRegistrationConfirmation) {
    const confirmationUrl = new URL(registrationConfirmationPath, requestUrl.origin);
    confirmationUrl.searchParams.set("estado", exchangeSucceeded ? "exitoso" : "error");
    return NextResponse.redirect(confirmationUrl);
  }

  return NextResponse.redirect(returnUrl);
}
```

- [ ] **Step 4: Run the callback tests and verify they pass**

Run:

```bash
corepack pnpm test tests/unit/auth-paths.test.ts tests/unit/auth-callback.test.ts --pool=forks --maxWorkers=1
```

Expected: all route-contract and callback tests pass, including the old recovery and safe-redirect cases.

- [ ] **Step 5: Commit the callback behavior**

```bash
git add src/lib/auth/paths.ts src/app/auth/callback/route.ts tests/unit/auth-paths.test.ts tests/unit/auth-callback.test.ts
git commit -m "fix: route email confirmation to success screen"
```

## Task 2: Add the centered registration-confirmation screen

**Files:**
- Create: `src/components/auth/registration-confirmation-card.tsx`
- Create: `src/app/registro-confirmado/page.tsx`
- Test: `tests/unit/registration-confirmation-card.test.tsx`

**Interfaces:**
- Produces `RegistrationConfirmationCard({ status: "success" | "error" })`.
- The page consumes `searchParams: Promise<{ estado?: string | string[] }>` and maps only `estado=exitoso` to the success state; every other value renders the controlled error state.

- [ ] **Step 1: Write the failing card tests**

Create `tests/unit/registration-confirmation-card.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RegistrationConfirmationCard } from "@/components/auth/registration-confirmation-card";

afterEach(cleanup);

describe("RegistrationConfirmationCard", () => {
  it("shows the successful email-confirmation message without a greeting", () => {
    render(<RegistrationConfirmationCard status="success" />);

    expect(screen.getByRole("heading", { name: "Correo confirmado" })).toBeInTheDocument();
    expect(screen.getByText("Tu registro se completó correctamente. Tu cuenta ya está lista.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar a Mis Finanzas" })).toHaveAttribute("href", "/");
    expect(screen.queryByText(/Bienvenido|Hola,/)).not.toBeInTheDocument();
  });

  it("shows a non-sensitive error state with a login action", () => {
    render(<RegistrationConfirmationCard status="error" />);

    expect(screen.getByRole("heading", { name: "No pudimos confirmar tu correo" })).toBeInTheDocument();
    expect(screen.getByText("El enlace puede haber vencido o ya fue utilizado. Volvé a iniciar sesión para continuar.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a iniciar sesión" })).toHaveAttribute("href", "/acceso");
  });
});
```

- [ ] **Step 2: Run the card tests and verify they fail**

Run:

```bash
corepack pnpm test tests/unit/registration-confirmation-card.test.tsx --pool=forks --maxWorkers=1
```

Expected: FAIL because the new component has not been created.

- [ ] **Step 3: Implement the card and page**

Create `src/components/auth/registration-confirmation-card.tsx`:

```tsx
import Link from "next/link";

type RegistrationConfirmationStatus = "success" | "error";

type RegistrationConfirmationCardProps = {
  status: RegistrationConfirmationStatus;
};

export function RegistrationConfirmationCard({ status }: RegistrationConfirmationCardProps) {
  const success = status === "success";
  const title = success ? "Correo confirmado" : "No pudimos confirmar tu correo";
  const description = success
    ? "Tu registro se completó correctamente. Tu cuenta ya está lista."
    : "El enlace puede haber vencido o ya fue utilizado. Volvé a iniciar sesión para continuar.";
  const actionLabel = success ? "Entrar a Mis Finanzas" : "Volver a iniciar sesión";
  const actionHref = success ? "/" : "/acceso";

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center px-5 py-10">
      <section className="rounded-[2rem] bg-surface p-7 text-center shadow-sm ring-1 ring-border/70 sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Mis Finanzas</p>
        <div
          aria-hidden="true"
          className={`mx-auto mt-8 grid size-14 place-items-center rounded-full text-2xl font-bold ${success ? "bg-brand text-brand-foreground" : "bg-danger/15 text-danger"}`}
        >
          {success ? "✓" : "!"}
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-4 leading-7 text-muted">{description}</p>
        <Link className="mt-8 inline-flex rounded-xl bg-brand px-5 py-3 font-semibold text-brand-foreground" href={actionHref}>
          {actionLabel}
        </Link>
      </section>
    </main>
  );
}
```

Create `src/app/registro-confirmado/page.tsx`:

```tsx
import { RegistrationConfirmationCard } from "@/components/auth/registration-confirmation-card";

type RegistrationConfirmationPageProps = {
  searchParams: Promise<{ estado?: string | string[] }>;
};

export default async function RegistrationConfirmationPage({ searchParams }: RegistrationConfirmationPageProps) {
  const { estado } = await searchParams;
  const status = estado === "exitoso" ? "success" : "error";

  return <RegistrationConfirmationCard status={status} />;
}
```

- [ ] **Step 4: Run the card tests and verify they pass**

Run:

```bash
corepack pnpm test tests/unit/registration-confirmation-card.test.tsx --pool=forks --maxWorkers=1
```

Expected: both success/error card tests pass, including the assertion that the success screen has no greeting.

- [ ] **Step 5: Commit the confirmation screen**

```bash
git add src/components/auth/registration-confirmation-card.tsx src/app/registro-confirmado/page.tsx tests/unit/registration-confirmation-card.test.tsx
git commit -m "feat: add registration confirmation screen"
```

## Task 3: Send registration emails to the confirmation screen

**Files:**
- Create: `src/lib/auth/redirects.ts`
- Modify: `src/components/auth/sign-up-form.tsx`
- Test: `tests/unit/auth-redirects.test.ts`
- Test: `tests/unit/sign-up-form.test.tsx`

**Interfaces:**
- Produces `getRegistrationConfirmationRedirect(origin: string): string` with the current origin and encoded `next=/registro-confirmado`.
- Produces `getRegistrationConfirmationPagePath(status?: "exitoso" | "error"): string` for internal client navigation.
- `SignUpForm` passes the first helper as `options.emailRedirectTo` and uses the second helper for an immediate-session success.

- [ ] **Step 1: Write the failing redirect and form tests**

Create `tests/unit/auth-redirects.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  getRegistrationConfirmationPagePath,
  getRegistrationConfirmationRedirect,
} from "@/lib/auth/redirects";

describe("registration redirects", () => {
  it("builds the callback URL from the active origin", () => {
    expect(getRegistrationConfirmationRedirect("https://app.test")).toBe(
      "https://app.test/auth/callback?next=%2Fregistro-confirmado",
    );
  });

  it("builds the success and error confirmation paths", () => {
    expect(getRegistrationConfirmationPagePath()).toBe("/registro-confirmado?estado=exitoso");
    expect(getRegistrationConfirmationPagePath("error")).toBe("/registro-confirmado?estado=error");
  });
});
```

Create `tests/unit/sign-up-form.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { createClient } from "@/lib/supabase/client";

const { signUp } = vi.hoisted(() => ({ signUp: vi.fn() }));

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);

beforeEach(() => {
  signUp.mockReset();
  signUp.mockResolvedValue({ data: { session: null }, error: null });
  mockedCreateClient.mockReturnValue({ auth: { signUp } } as never);
});

afterEach(() => {
  cleanup();
  mockedCreateClient.mockReset();
});

describe("SignUpForm with Supabase configured", () => {
  it("sends the confirmation callback as emailRedirectTo", async () => {
    render(<SignUpForm />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "ana@example.com" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "segura123" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear mi cuenta" }));

    await waitFor(() => expect(signUp).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "segura123",
      options: { emailRedirectTo: "http://localhost:3000/auth/callback?next=%2Fregistro-confirmado" },
    }));
    expect(await screen.findByText("Cuenta creada. Revisá tu correo si se solicita confirmación.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the redirect/form tests and verify they fail**

Run:

```bash
corepack pnpm test tests/unit/auth-redirects.test.ts tests/unit/sign-up-form.test.tsx --pool=forks --maxWorkers=1
```

Expected: FAIL because the redirect helpers do not exist and the form still calls `signUp` without `options.emailRedirectTo`.

- [ ] **Step 3: Implement the helpers and update `SignUpForm`**

Create `src/lib/auth/redirects.ts`:

```ts
import { registrationConfirmationPath } from "@/lib/auth/paths";

export type RegistrationConfirmationStatus = "exitoso" | "error";

export function getRegistrationConfirmationRedirect(origin: string): string {
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", registrationConfirmationPath);
  return callbackUrl.toString();
}

export function getRegistrationConfirmationPagePath(status: RegistrationConfirmationStatus = "exitoso"): string {
  return `${registrationConfirmationPath}?estado=${status}`;
}
```

Replace `src/components/auth/sign-up-form.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthConfigurationNotice } from "@/components/auth/auth-configuration-notice";
import { getRegistrationConfirmationPagePath, getRegistrationConfirmationRedirect } from "@/lib/auth/redirects";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

export function SignUpForm() {
  const [showNotice, setShowNotice] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured()) { setShowNotice(true); return; }
    setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const { data, error } = await createClient().auth.signUp({
      email: String(form.get("email")),
      password: String(form.get("password")),
      options: { emailRedirectTo: getRegistrationConfirmationRedirect(window.location.origin) },
    });
    setSaving(false);
    if (error) { setMessage("No pudimos crear la cuenta. Revisá los datos e intentá de nuevo."); return; }
    if (data.session) {
      window.location.assign(getRegistrationConfirmationPagePath());
      return;
    }
    setMessage("Cuenta creada. Revisá tu correo si se solicita confirmación.");
  }

  return <form className="grid gap-5" onSubmit={handleSubmit}>
    <label className="grid gap-2 text-sm font-semibold">Correo electrónico<input className="rounded-xl border border-border bg-background px-4 py-3" name="email" type="email" required autoComplete="email" /></label>
    <label className="grid gap-2 text-sm font-semibold">Contraseña<input className="rounded-xl border border-border bg-background px-4 py-3" name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
    {showNotice ? <AuthConfigurationNotice /> : null}{message ? <p aria-live="polite" role="status">{message}</p> : null}
    <button className="rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground disabled:opacity-70" disabled={saving} type="submit">{saving ? "Creando…" : "Crear mi cuenta"}</button>
    <p className="text-sm text-muted">¿Ya tienes una cuenta? <Link className="text-brand underline" href="/acceso">Iniciar sesión</Link></p>
  </form>;
}
```

- [ ] **Step 4: Run the redirect/form tests and verify they pass**

Run:

```bash
corepack pnpm test tests/unit/auth-redirects.test.ts tests/unit/sign-up-form.test.tsx --pool=forks --maxWorkers=1
```

Expected: all helper and configured-form tests pass, including the exact `emailRedirectTo` sent to Supabase.

- [ ] **Step 5: Commit the registration redirect**

```bash
git add src/lib/auth/redirects.ts src/components/auth/sign-up-form.tsx tests/unit/auth-redirects.test.ts tests/unit/sign-up-form.test.tsx
git commit -m "feat: send registration emails to confirmation screen"
```

## Task 4: Add the compact authenticated greeting

**Files:**
- Create: `src/lib/auth/greeting.ts`
- Modify: `src/components/app-shell.tsx`
- Test: `tests/unit/greeting.test.ts`
- Test: `tests/unit/app-shell.test.tsx`

**Interfaces:**
- Produces `getGreetingLabel(displayName: string | null | undefined): string`.
- `AppShell` keeps its existing `children` prop and uses the returned label in the desktop sidebar and mobile header.
- The profile lookup reads only `display_name` for the authenticated user and falls back without blocking navigation.

- [ ] **Step 1: Write the failing greeting tests**

Create `tests/unit/greeting.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getGreetingLabel } from "@/lib/auth/greeting";

describe("greeting labels", () => {
  it("uses a trimmed profile name", () => {
    expect(getGreetingLabel("  Ana  ")).toBe("Hola, Ana");
  });

  it("does not expose an email when the profile name is unavailable", () => {
    expect(getGreetingLabel("")).toBe("Bienvenido/a");
    expect(getGreetingLabel(null)).toBe("Bienvenido/a");
    expect(getGreetingLabel(undefined)).toBe("Bienvenido/a");
  });
});
```

Create `tests/unit/app-shell.test.tsx`:

```tsx
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);

function mockProfile(displayName: string | null, profileError: object | null = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { display_name: displayName }, error: profileError });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  mockedCreateClient.mockReturnValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
    from: vi.fn().mockReturnValue({ select }),
  } as never);
}

beforeEach(() => mockProfile("Ana"));
afterEach(() => { cleanup(); mockedCreateClient.mockReset(); });

describe("AppShell greeting", () => {
  it("renders the profile name in the compact greeting", async () => {
    render(<AppShell><p>Contenido</p></AppShell>);

    await waitFor(() => expect(screen.getAllByText("Hola, Ana").length).toBeGreaterThan(0));
  });

  it("keeps the generic greeting when the profile query fails", async () => {
    mockProfile(null, { message: "profile unavailable" });
    render(<AppShell><p>Contenido</p></AppShell>);

    await waitFor(() => expect(screen.getAllByText("Bienvenido/a").length).toBeGreaterThan(0));
    expect(screen.queryByText(/Hola,/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the greeting tests and verify they fail**

Run:

```bash
corepack pnpm test tests/unit/greeting.test.ts tests/unit/app-shell.test.tsx --pool=forks --maxWorkers=1
```

Expected: FAIL because the greeting helper is absent and `AppShell` does not yet query `profiles` or render the new label.

- [ ] **Step 3: Implement the greeting helper and integrate it into `AppShell`**

Create `src/lib/auth/greeting.ts`:

```ts
export function getGreetingLabel(displayName: string | null | undefined): string {
  const normalizedName = displayName?.trim();
  return normalizedName ? `Hola, ${normalizedName}` : "Bienvenido/a";
}
```

In `src/components/app-shell.tsx`, use these imports:

```tsx
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { getGreetingLabel } from "@/lib/auth/greeting";
import { site } from "@/lib/site";
import { createClient } from "@/lib/supabase/client";
```

At the beginning of `AppShell`, immediately before `const balancesHidden = useBalancesHidden();`, add:

```tsx
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDisplayName() {
      const client = createClient();
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData.user) return;

      const { data } = await client
        .from("profiles")
        .select("display_name")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (active) setDisplayName(data?.display_name ?? null);
    }

    void loadDisplayName();
    return () => { active = false; };
  }, []);

  const greeting = getGreetingLabel(displayName);
```

Replace the mobile header body with:

```tsx
      <header className="border-b border-border/70 bg-background/85 px-5 py-4 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <p className="font-serif text-xl font-semibold tracking-tight">{site.name}</p>
          <p className="text-right text-sm font-semibold text-text">{greeting}</p>
        </div>
      </header>
```

Inside the `nav` inner `div`, directly after the closing `</ul>` and before the balance button, add:

```tsx
          <div className="hidden border-t border-border/80 px-3 pt-5 lg:mt-auto lg:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Tu espacio</p>
            <p className="mt-1 text-sm font-semibold text-text">{greeting}</p>
          </div>
```

In the existing balance button class, replace `lg:mt-auto` with `lg:mt-3` so the greeting remains immediately above `Ocultar saldos`:

```tsx
className="absolute -top-12 right-2 grid size-10 place-items-center rounded-full border border-line bg-panel-raised text-text shadow-lg shadow-black/30 transition-colors hover:border-signal hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal lg:static lg:mt-3 lg:flex lg:h-auto lg:w-full lg:items-center lg:justify-center lg:gap-3 lg:rounded-xl lg:px-3 lg:py-3 lg:text-sm lg:font-semibold"
```

The `active` guard keeps an unmounted shell from receiving the asynchronous profile result. A profile query error leaves `displayName` as `null`, so the rendered label remains `Bienvenido/a` and the existing navigation/control behavior is unchanged.

- [ ] **Step 4: Run the greeting tests and verify they pass**

Run:

```bash
corepack pnpm test tests/unit/greeting.test.ts tests/unit/app-shell.test.tsx --pool=forks --maxWorkers=1
```

Expected: all helper and AppShell tests pass; the named profile renders as `Hola, Ana`, and a failed profile query renders only `Bienvenido/a`.

- [ ] **Step 5: Commit the compact greeting**

```bash
git add src/lib/auth/greeting.ts src/components/app-shell.tsx tests/unit/greeting.test.ts tests/unit/app-shell.test.tsx
git commit -m "feat: add compact authenticated greeting"
```

## Task 5: Run the complete verification and manual flow

**Files:**
- Verify: `src/app/registro-confirmado/page.tsx`, `src/app/auth/callback/route.ts`, `src/components/auth/sign-up-form.tsx`, `src/components/app-shell.tsx`
- Verify: all files under `tests/unit/`

**Interfaces:**
- The finished application exposes the public confirmation route, keeps recovery callbacks working, and renders the profile-aware greeting only inside the authenticated shell.

- [ ] **Step 1: Run the complete unit suite serially**

Run:

```bash
corepack pnpm test --pool=forks --maxWorkers=1
```

Expected: every unit test passes with no Vitest worker timeout.

- [ ] **Step 2: Run typecheck, lint, and production build**

Run each command from the repository root:

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
```

Expected: TypeScript reports no errors, ESLint reports no errors, and Next.js produces a successful production build using the existing public Supabase environment configuration.

- [ ] **Step 3: Verify the local public routes**

Start the production server on an unused local port and request the routes:

```bash
corepack pnpm start -p 3030
```

Verify with a browser or HTTP client:

```text
GET http://localhost:3030/registro-confirmado?estado=exitoso
  -> 200, heading "Correo confirmado", no "Hola," or "Bienvenido/a"

GET http://localhost:3030/registro-confirmado?estado=error
  -> 200, heading "No pudimos confirmar tu correo", link to /acceso
```

Stop the server after these checks.

- [ ] **Step 4: Verify the full Supabase email flow**

Using a test email allowed by the Supabase project:

1. Open `/registro`, submit the form, and confirm that the UI tells the user to review the email instead of redirecting to login.
2. Open the Supabase confirmation link and confirm that the browser lands on `/registro-confirmado?estado=exitoso`.
3. Confirm the screen says `Correo confirmado`, has `Entrar a Mis Finanzas`, and has no greeting.
4. Follow `Entrar a Mis Finanzas`; after the authenticated page loads, confirm the sidebar shows `Hola, ` followed by the configured profile name.
5. Clear the profile name in `/perfil`, reload an authenticated page, and confirm the sidebar shows `Bienvenido/a` without displaying the email.
6. Repeat once at a mobile viewport and confirm the greeting appears in the top header while the bottom navigation and `Ocultar saldos` control remain usable.

- [ ] **Step 5: Confirm the external redirect allowlist before deployment**

In Supabase Auth URL Configuration, keep the local callback URL `http://localhost:3000/auth/callback` and add `/auth/callback` to the real deployed Vercel origin used by the test. The change must be followed by a fresh deployment if the application environment variables are changed.

- [ ] **Step 6: Review the final worktree**

Run:

```bash
git status --short --branch
```

Expected: only intentional commits are present, `.superpowers/` remains ignored, and there are no generated secrets or environment files in the worktree.
