# Profile Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar y actualizar el nombre visible del usuario autenticado desde `/perfil`.

**Architecture:** Un componente cliente obtiene el usuario desde Supabase Auth y su fila propia desde `profiles`. El correo se presenta como lectura sola; el guardado hace `update({ display_name })` filtrado por el identificador autenticado, protegido por la política RLS existente.

**Tech Stack:** Next.js App Router, React 19, TypeScript estricto, Supabase browser client, Vitest y Testing Library.

## Global Constraints

- Solo `profiles.display_name` es editable.
- El correo procede de Auth y no se escribe desde este formulario.
- No usar claves de servicio ni cambiar migraciones o RLS.
- El nombre no puede quedar vacío tras aplicar `trim()`.

---

### Task 1: Construir el formulario de perfil y sus pruebas

**Files:**
- Create: `src/components/profile/profile-form.tsx`
- Create: `tests/unit/profile-form.test.tsx`

**Interfaces:**
- Produces: `ProfileForm(): JSX.Element`.
- Consumes: `createClient().auth.getUser()` y `createClient().from("profiles")`.
- Reads: `profiles.display_name` mediante `.select("display_name").eq("id", user.id).maybeSingle()`.
- Writes: `.update({ display_name: normalizedName }).eq("id", user.id)`.

- [ ] **Step 1: Escribir las pruebas que fallan.**

Crear mocks encadenables y cubrir: nombre/correo cargados, perfil sin fila,
sesión ausente, nombre vacío, error de lectura y guardado exitoso.

```tsx
it("saves a trimmed display name for the authenticated profile", async () => {
  const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
  mockClient({ user: { id: "user-1", email: "ana@example.com" }, profile: { display_name: "Ana" }, update });
  render(<ProfileForm />);
  fireEvent.change(await screen.findByLabelText("Nombre"), { target: { value: "  Ana P.  " } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(update).toHaveBeenCalledWith({ display_name: "Ana P." }));
});
```

- [ ] **Step 2: Ejecutar la prueba para confirmar el fallo.**

Run: `corepack pnpm test tests/unit/profile-form.test.tsx`

Expected: falla porque `ProfileForm` aún no existe.

- [ ] **Step 3: Implementar `ProfileForm`.**

Usar estados `loading`, `displayName`, `email`, `message` y `saving`. Tras
`getUser`, cargar la fila propia con `maybeSingle`; si falta, iniciar el campo
vacío. Renderizar correo como texto, nombre con `label htmlFor="profile-name"`,
mensajes `aria-live="polite"` y botón deshabilitado durante el guardado.

```tsx
const normalizedName = displayName.trim();
if (!normalizedName) {
  setMessage("Ingresá un nombre para tu perfil.");
  return;
}
const { error } = await client
  .from("profiles")
  .update({ display_name: normalizedName })
  .eq("id", user.id);
```

- [ ] **Step 4: Ejecutar la prueba enfocada.**

Run: `corepack pnpm test tests/unit/profile-form.test.tsx`

Expected: todas las pruebas de perfil pasan.

- [ ] **Step 5: Confirmar el cambio.**

Run: `git diff --check -- src/components/profile/profile-form.tsx tests/unit/profile-form.test.tsx`

Expected: sin errores de espacios.

### Task 2: Integrar la ruta protegida y validar el proyecto

**Files:**
- Modify: `src/app/perfil/page.tsx`
- Test: `tests/unit/profile-form.test.tsx`

**Interfaces:**
- Consumes: `ProfileForm` de `src/components/profile/profile-form.tsx`.
- Produces: `/perfil` con formulario de identidad editable dentro de `AppShell`.

- [ ] **Step 1: Reemplazar el marcador de posición de la página.**

Importar y renderizar el formulario:

```tsx
import { ProfileForm } from "@/components/profile/profile-form";

<h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">Perfil</h1>
<p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">
  Mantené actualizado el nombre con el que te reconocemos.
</p>
<div className="mt-10"><ProfileForm /></div>
```

- [ ] **Step 2: Ejecutar las compuertas de calidad.**

Run:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

Expected: todos los comandos finalizan con código `0`.

- [ ] **Step 3: Revisar los archivos intencionales.**

Run: `git status --short`

Expected: revisar solo `src/components/profile/`, `src/app/perfil/page.tsx` y
`tests/unit/profile-form.test.tsx`; no incluir `.env.local` ni cambios ajenos.

## Self-Review

- Cobertura: la tarea 1 cubre lectura, validación, guardado y estados; la tarea
  2 integra la ruta y ejecuta todas las compuertas.
- Marcadores: no hay pasos indefinidos.
- Consistencia: la lectura y escritura usan `display_name` y el mismo `user.id`.
