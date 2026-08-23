# Auth UI Without Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exponer acceso, registro y recuperación accesibles sin permitir autenticación simulada mientras Supabase no tenga variables configuradas.

**Architecture:** Un módulo puro identifica una configuración pública válida de Supabase. Las páginas públicas reutilizan formularios cliente pequeños que validan su entrada y muestran un estado de configuración pendiente; un proxy de Next protege rutas privadas y conserva solo retornos internos validados por `safeReturnPath`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Vitest, Testing Library y Playwright.

## Global Constraints

- No crear usuarios locales, sesiones ficticias, tablas ni llamadas de autenticación mientras falte configuración.
- No exponer URL, claves ni detalles de entorno en la interfaz o en pruebas.
- Los retornos solo aceptan rutas internas y no rutas de autenticación.
- Google y Apple no se muestran activos sin variables públicas habilitadas.
- Mantener la portada pública y usar copy accesible en español.

---

### Task 1: Crear contrato de configuración y rutas privadas

**Files:**
- Create: `src/lib/supabase/config.ts`, `src/proxy.ts`, `tests/unit/supabase-config.test.ts`.
- Modify: `src/lib/auth/paths.ts`.

**Interfaces:**
- Produces: `isSupabaseConfigured(): boolean`, `isProviderEnabled(provider: "google" | "apple"): boolean`, `privatePaths`, `safeReturnPath(value)` y `proxy(request)`.

- [ ] **Step 1: Escribir pruebas unitarias fallidas**

Cubrir URL o clave ausente, ambas variables presentes, flags de proveedores y que `/perfil` sea privado mientras `https://externo.test`, `//externo.test` y `/acceso` devuelvan `/resumen`.

- [ ] **Step 2: Implementar contratos puros**

El módulo de configuración debe devolver `true` solamente con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no vacías y distintas de los valores de ejemplo. El proxy debe redirigir rutas privadas a `/acceso?next=<ruta codificada>` sin crear una sesión.

- [ ] **Step 3: Verificar contratos**

Ejecutar `node_modules\\.bin\\vitest.cmd run tests/unit/supabase-config.test.ts` y esperar PASS.

### Task 2: Implementar formularios y páginas de acceso

**Files:**
- Create: `src/components/auth/auth-configuration-notice.tsx`, `src/components/auth/sign-in-form.tsx`, `src/components/auth/sign-up-form.tsx`, `src/components/auth/password-recovery-form.tsx`, `src/app/acceso/page.tsx`, `src/app/registro/page.tsx`, `src/app/recuperar-contrasena/page.tsx`, `tests/unit/auth-forms.test.tsx`.
- Modify: `src/app/page.tsx`.

**Interfaces:**
- Produces: `SignInForm({ next?: string })`, `SignUpForm()`, `PasswordRecoveryForm()` y tres páginas públicas.

- [ ] **Step 1: Escribir pruebas de componentes fallidas**

Comprobar etiquetas `Correo electrónico` y `Contraseña`, los botones `Iniciar sesión`, `Crear mi cuenta` y `Enviar instrucciones`, enlaces entre flujos y el aviso de configuración tras enviar cada formulario sin Supabase.

- [ ] **Step 2: Implementar formularios accesibles**

Usar etiquetas visibles, tipos de entrada correctos, `required`, validación local mínima y estados de envío. Sin configuración válida, prevenir el envío real y mostrar `La autenticación estará disponible cuando se configure el servicio.`. No mostrar controles Google o Apple.

- [ ] **Step 3: Implementar páginas y portada**

Cada página tendrá un `h1` único: `Iniciar sesión`, `Quiero ser cliente` o `Recuperar contraseña`. La portada debe contener enlaces visibles a `/acceso` y `/registro` sin exponer navegación financiera anónima.

- [ ] **Step 4: Verificar formularios**

Ejecutar `node_modules\\.bin\\vitest.cmd run tests/unit/auth-forms.test.tsx` y esperar PASS.

### Task 3: Ajustar navegación, comprobar y documentar

**Files:**
- Modify: `src/components/app-shell.tsx`, `tests/unit/app-shell.test.tsx`, `tests/e2e/public-navigation.spec.ts`, `docs/implementation-phases.md`.

**Interfaces:**
- Consumes: rutas públicas de Task 2 y protección de Task 1.
- Produces: navegación anónima segura y evidencia de verificación.

- [ ] **Step 1: Retirar destinos financieros públicos**

El shell público debe ofrecer solamente las acciones de acceso y registro. Los enlaces a resumen, movimientos, grupos y perfil se reservan para la futura sesión autenticada.

- [ ] **Step 2: Escribir pruebas de navegación**

La prueba E2E debe confirmar que la portada llega a acceso y registro, y que `/perfil`, `/movimientos` y `/grupos` redirigen a `/acceso` con un retorno interno.

- [ ] **Step 3: Ejecutar verificación**

Ejecutar `node_modules\\.bin\\eslint.cmd .`, `node_modules\\.bin\\tsc.cmd --noEmit --incremental false`, `node_modules\\.bin\\vitest.cmd run`, `node_modules\\.bin\\next.cmd build` y `node_modules\\.bin\\playwright.cmd test`. Documentar los resultados y cualquier bloqueo externo de fuentes en `docs/implementation-phases.md`.

- [ ] **Step 4: Confirmar cambios**

Ejecutar `git add src tests docs package.json pnpm-lock.yaml .env.example` y `git commit -m "feat: add auth UI without Supabase"`, excluyendo cambios locales ajenos y archivos generados.

## Self-review

- Cobertura: incluye páginas, estado sin configuración, privacidad de rutas, navegación, pruebas y documentación.
- Sin marcadores: cada tarea nombra archivos, contratos y criterio de verificación.
- Consistencia: todos los flujos usan las mismas rutas y la política `safeReturnPath`.
