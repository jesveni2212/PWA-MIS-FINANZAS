# Autenticación real con Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activar registro, acceso, recuperación y cierre de sesión reales mediante Supabase Auth, con sesiones SSR seguras y Google/Apple preparados pero inactivos.

**Architecture:** Clientes Supabase separados para navegador, servidor y Proxy mantienen las sesiones PKCE en cookies. El servidor valida al usuario con `getUser()` antes de entregar rutas privadas; PostgreSQL RLS sigue siendo la autorización de los datos. Los formularios cliente sólo invocan los flujos Auth, nunca reciben secretos administrativos.

**Tech Stack:** Next.js 16.3, React 19, TypeScript, `@supabase/ssr`, `@supabase/supabase-js`, Vitest, Testing Library, Playwright y Supabase PostgreSQL.

## Global Constraints

- Usar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sólo para clientes públicos; nunca crear ni exponer `service_role`.
- Validar usuarios en servidor con `supabase.auth.getUser()`; no usar `getSession()` como prueba de identidad.
- Las URL de retorno se limitan a rutas internas mediante `safeReturnPath`.
- Google y Apple permanecen ocultos hasta que sus banderas públicas sean `true` y los proveedores estén configurados en Supabase.
- No subir `.env.local`, secretos OAuth, cadenas PostgreSQL ni resultados de migraciones con datos personales.
- Mantener RLS activa; ninguna mutación de datos financieros usa una clave privilegiada en nombre de un usuario.
- Ejecutar lint, tipado, pruebas unitarias, build y E2E antes de cierre; las pruebas contra Supabase real se ejecutan sólo con un proyecto aislado configurado.

---

## Estructura de archivos

- `src/lib/supabase/client.ts`: crea el cliente del navegador con las dos variables públicas.
- `src/lib/supabase/server.ts`: crea un cliente por petición, vinculado al almacén de cookies de Next.
- `src/lib/supabase/proxy.ts`: refresca la sesión y devuelve el usuario validado al Proxy.
- `src/proxy.ts`: redirige anónimos de rutas privadas después de refrescar cookies.
- `src/app/auth/callback/route.ts`: intercambia el código PKCE y redirige a una ruta interna segura.
- `src/app/actualizar-contrasena/page.tsx` y `src/components/auth/update-password-form.tsx`: permiten establecer la contraseña de una sesión de recuperación.
- `src/components/auth/*.tsx`: conectan los formularios existentes a Supabase y muestran estados seguros.
- `tests/unit/*`: comprueban clientes, formularios y retorno seguro sin tocar una cuenta real.
- `tests/e2e/auth.spec.ts`: cubre redirecciones de anónimos y, si hay entorno configurado, los flujos reales con usuarios de prueba únicos.
- `docs/supabase-setup.md`: detalla configuración manual, migración y verificación sin almacenar secretos.

---

### Task 1: Clientes SSR y actualización segura de sesión

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/proxy.ts`, `tests/unit/supabase-clients.test.ts`.
- Modify: `src/proxy.ts`.

**Interfaces:**
- Produces: `createBrowserClient(): SupabaseClient`, `createServerClient(): Promise<SupabaseClient>`, `updateSession(request): Promise<{ response: NextResponse; user: User | null }>`.
- Consumes: configuración ya existente de `src/lib/supabase/config.ts` y `isPrivatePath(pathname)`.

- [ ] **Step 1: Escribir las pruebas unitarias fallidas**

```ts
it("does not expose a server secret in the browser client", () => {
  expect(browserEnvironmentKeys).toEqual([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ]);
});

it("redirects an anonymous private request after refreshing its session", async () => {
  const response = await proxy(new NextRequest("https://app.test/perfil"));
  expect(response.headers.get("location")).toBe("https://app.test/acceso?next=%2Fperfil");
});
```

- [ ] **Step 2: Ejecutar la prueba para comprobar el fallo**

Run: `node_modules\\.bin\\vitest.cmd run tests/unit/supabase-clients.test.ts`

Expected: FAIL porque los módulos de cliente y actualización de sesión aún no existen.

- [ ] **Step 3: Implementar los clientes y el refresco de cookies**

```ts
// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

```ts
// src/lib/supabase/proxy.ts (esquema obligatorio)
const { data: { user } } = await supabase.auth.getUser();
return { response: supabaseResponse, user };
```

El cliente de servidor implementa `cookies.getAll()` y `cookies.setAll()` con
`await cookies()`. El Proxy llama a `updateSession`, conserva las cookies de
la respuesta y sólo redirige cuando `isPrivatePath` y `user === null`.

- [ ] **Step 4: Ejecutar pruebas enfocadas**

Run: `node_modules\\.bin\\vitest.cmd run tests/unit/supabase-clients.test.ts tests/unit/auth-paths.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase src/proxy.ts tests/unit/supabase-clients.test.ts
git commit -m "feat: add Supabase SSR session clients"
```

### Task 2: Callback PKCE y formularios de correo/contraseña

**Files:**
- Create: `src/app/auth/callback/route.ts`, `tests/unit/auth-callback.test.ts`.
- Modify: `src/components/auth/sign-in-form.tsx`, `src/components/auth/sign-up-form.tsx`, `src/components/auth/password-recovery-form.tsx`, `tests/unit/auth-forms.test.tsx`.

**Interfaces:**
- Produces: `GET(request: NextRequest): Promise<NextResponse>` en callback y formularios que llaman `signInWithPassword`, `signUp` y `resetPasswordForEmail`.
- Consumes: `createClient` del navegador, `safeReturnPath(value)`, `NEXT_PUBLIC_APP_URL` y la ruta `/auth/callback`.

- [ ] **Step 1: Escribir las pruebas fallidas de formularios y callback**

```tsx
expect(signIn).toHaveBeenCalledWith({ email: "ana@example.com", password: "segura123" });
expect(screen.getByRole("status")).toHaveTextContent("Revisa tu correo para confirmar tu cuenta.");
expect(resetPasswordForEmail).toHaveBeenCalledWith("ana@example.com", {
  redirectTo: "http://localhost:3000/auth/callback?next=%2Factualizar-contrasena",
});
```

```ts
expect(location(response)).toBe("https://app.test/perfil");
expect(location(await GET(new NextRequest("https://app.test/auth/callback?next=https://bad.test"))))
  .toBe("https://app.test/resumen");
```

- [ ] **Step 2: Ejecutar las pruebas para comprobar el fallo**

Run: `node_modules\\.bin\\vitest.cmd run tests/unit/auth-forms.test.tsx tests/unit/auth-callback.test.ts`

Expected: FAIL porque los formularios todavía sólo muestran el aviso de configuración.

- [ ] **Step 3: Conectar los flujos reales con mensajes seguros**

```ts
const { error } = await createClient().auth.signInWithPassword({ email, password });
if (error) setMessage("No pudimos iniciar sesión. Revisa tus datos e inténtalo de nuevo.");
else window.location.assign(safeReturnPath(next));
```

Registro invoca `signUp({ email, password, options: { emailRedirectTo: callbackUrl } })`
y muestra únicamente `Revisa tu correo para confirmar tu cuenta.`. Recuperación
invoca `resetPasswordForEmail` y responde con el mismo mensaje genérico para
un correo existente o inexistente. El callback intercambia `code` mediante
`exchangeCodeForSession(code)` y redirige sólo con `safeReturnPath`.

- [ ] **Step 4: Ejecutar las pruebas enfocadas**

Run: `node_modules\\.bin\\vitest.cmd run tests/unit/auth-forms.test.tsx tests/unit/auth-callback.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/callback src/components/auth tests/unit/auth-forms.test.tsx tests/unit/auth-callback.test.ts
git commit -m "feat: connect email authentication forms"
```

### Task 3: Actualización de contraseña y salida de sesión

**Files:**
- Create: `src/app/actualizar-contrasena/page.tsx`, `src/components/auth/update-password-form.tsx`, `src/app/api/auth/sign-out/route.ts`.
- Modify: `src/app/acceso/page.tsx`, `tests/unit/auth-forms.test.tsx`.
- Test: `tests/unit/update-password-form.test.tsx`, `tests/unit/sign-out.test.ts`.

**Interfaces:**
- Produces: `UpdatePasswordForm()` que llama `auth.updateUser({ password })` y `POST /api/auth/sign-out` que invoca `auth.signOut()`.
- Consumes: cliente del navegador/servidor y el callback de recuperación de Task 2.

- [ ] **Step 1: Escribir las pruebas fallidas**

```tsx
fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "segura123" } });
fireEvent.click(screen.getByRole("button", { name: "Actualizar contraseña" }));
expect(updateUser).toHaveBeenCalledWith({ password: "segura123" });
```

```ts
expect(signOut).toHaveBeenCalledOnce();
expect(response.status).toBe(204);
```

- [ ] **Step 2: Ejecutar pruebas para comprobar el fallo**

Run: `node_modules\\.bin\\vitest.cmd run tests/unit/update-password-form.test.tsx tests/unit/sign-out.test.ts`

Expected: FAIL porque no existen página, formulario ni ruta de salida.

- [ ] **Step 3: Implementar la actualización y salida**

El formulario requiere longitud mínima de ocho, envía `updateUser`, muestra un
mensaje de éxito sin mostrar datos de sesión y redirige a `/acceso`. La ruta
POST de salida usa el cliente de servidor, llama `signOut()` y devuelve 204;
el cliente navega a `/acceso` después de una respuesta correcta.

- [ ] **Step 4: Ejecutar pruebas enfocadas**

Run: `node_modules\\.bin\\vitest.cmd run tests/unit/update-password-form.test.tsx tests/unit/sign-out.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/actualizar-contrasena src/app/api/auth/sign-out src/components/auth/update-password-form.tsx tests/unit
git commit -m "feat: add password update and sign out"
```

### Task 4: Configuración manual de Supabase, migración y OAuth preparado

**Files:**
- Create: `docs/supabase-setup.md`.
- Modify: `.env.example`, `src/components/auth/sign-in-form.tsx`, `src/components/auth/sign-up-form.tsx`, `tests/unit/supabase-config.test.ts`, `docs/implementation-phases.md`.

**Interfaces:**
- Produces: guía reproducible sin secretos y botones `Continuar con Google`/`Continuar con Apple` que sólo aparecen si `isProviderEnabled` devuelve `true`.
- Consumes: `supabase/migrations/20260821_identity_security.sql`, banderas `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` y `NEXT_PUBLIC_APPLE_AUTH_ENABLED`.

- [ ] **Step 1: Escribir pruebas de visibilidad OAuth fallidas**

```tsx
render(<SignInForm />);
expect(screen.queryByRole("button", { name: "Continuar con Google" })).not.toBeInTheDocument();

mockEnvironment({ NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "true" });
expect(screen.getByRole("button", { name: "Continuar con Google" })).toBeInTheDocument();
```

- [ ] **Step 2: Ejecutar la prueba para comprobar el fallo**

Run: `node_modules\\.bin\\vitest.cmd run tests/unit/auth-forms.test.tsx tests/unit/supabase-config.test.ts`

Expected: FAIL porque los botones OAuth aún no existen.

- [ ] **Step 3: Implementar banderas y documentar el procedimiento manual**

Cada botón visible llama `signInWithOAuth({ provider, options: { redirectTo:
callbackUrl } })`. La guía exige, en este orden: crear `.env.local`, pegar URL y
clave publicable, configurar Site URL/redirect URL en Supabase, ejecutar la
migración versionada en SQL Editor, activar confirmación de email, probar con
una cuenta de prueba y guardar Google/Apple como desactivados hasta poseer sus
credenciales. Documentar que Apple requiere rotación semestral del secreto.

- [ ] **Step 4: Aplicar la migración con la persona responsable**

Run in Supabase SQL Editor: contenido exacto de `supabase/migrations/20260821_identity_security.sql`.

Expected: tablas `profiles`, `financial_spaces`, `memberships`, políticas RLS y
trigger `on_auth_user_created` creados sin exponer resultados ni datos reales
en el repositorio.

- [ ] **Step 5: Ejecutar pruebas enfocadas**

Run: `node_modules\\.bin\\vitest.cmd run tests/unit/auth-forms.test.tsx tests/unit/supabase-config.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .env.example src/components/auth tests/unit docs/supabase-setup.md docs/implementation-phases.md
git commit -m "docs: add secure Supabase setup guidance"
```

### Task 5: Verificación integral y evidencia de fase

**Files:**
- Create: `tests/e2e/auth.spec.ts`.
- Modify: `docs/implementation-phases.md`.

**Interfaces:**
- Consumes: todos los flujos de Tasks 1–4.
- Produces: evidencia reproducible de rutas privadas, retorno seguro y autenticación real configurada.

- [ ] **Step 1: Escribir E2E de rutas y retorno seguro**

```ts
for (const path of ["/perfil", "/movimientos", "/grupos"]) {
  test(`${path} redirects anonymous users to sign in`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/acceso\\?next=${encodeURIComponent(path)}`));
  });
}
```

- [ ] **Step 2: Ejecutar E2E para comprobar el fallo o cobertura faltante**

Run: `node_modules\\.bin\\playwright.cmd test tests/e2e/auth.spec.ts`

Expected: FAIL hasta que exista la especificación; PASS tras implementar la
prueba y los flujos.

- [ ] **Step 3: Añadir escenario real condicionado por entorno**

Usar `SUPABASE_E2E_EMAIL` y `SUPABASE_E2E_PASSWORD` sólo desde el entorno
local/CI protegido. Si faltan, omitir el escenario real con una anotación
explícita; nunca usar una cuenta personal ni crear credenciales de prueba en
el código.

- [ ] **Step 4: Ejecutar compuerta de calidad**

Run:

```powershell
node_modules\\.bin\\eslint.cmd .
node_modules\\.bin\\tsc.cmd --noEmit --incremental false
node_modules\\.bin\\vitest.cmd run
node_modules\\.bin\\next.cmd build
node_modules\\.bin\\playwright.cmd test
```

Expected: los cinco comandos finalizan con código 0. Registrar advertencias
externas sin ocultarlas.

- [ ] **Step 5: Documentar resultado y commit**

```bash
git add tests/e2e/auth.spec.ts docs/implementation-phases.md
git commit -m "test: verify real Supabase authentication"
```

## Self-review

- Cobertura: Tasks 1–5 implementan sesiones SSR, correo/contraseña, callback,
  recuperación, salida, RLS aplicada, OAuth condicionado y verificación.
- Secretos: ninguna tarea solicita pegar valores en Git, pruebas o documentos.
- Consistencia: todos los retornos pasan por `safeReturnPath`; la identidad se
  valida con `getUser()` antes de autorizar rutas privadas.
- Alcance: no añade Prisma, Auth0, integraciones bancarias ni modelo financiero.
