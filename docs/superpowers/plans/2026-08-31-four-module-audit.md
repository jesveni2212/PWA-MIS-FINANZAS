# Four-Module Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verificar de forma reproducible los flujos existentes de perfil, grupos, cuentas y movimientos antes de corregir o ampliar cualquiera de ellos.

**Architecture:** La auditoría es de solo lectura sobre código, migraciones, políticas y pruebas locales. Cada módulo se evalúa en su propio informe contra su interfaz Supabase y estados de UI; un hallazgo funcional abre una especificación focalizada, en lugar de editar varios módulos juntos.

**Tech Stack:** Next.js App Router 16.3.1, React 19, TypeScript estricto, Supabase browser client, PostgreSQL/RLS y Vitest.

## Global Constraints

- Usar únicamente el cliente público de Supabase; no usar claves de servicio.
- No modificar migraciones, RLS, código, configuración ni el proyecto remoto durante la auditoría.
- No exponer valores de `.env.local` ni datos financieros.
- Mantener las operaciones de grupos limitadas a `create_shared_group` y a filas visibles por RLS.
- Mantener cuentas dentro del espacio personal autorizado y movimientos dentro de espacios visibles por RLS.
- No agrupar correcciones de módulos distintos en una misma especificación.

---

## File Structure

- Read: `src/components/profile/profile-form.tsx` y `tests/unit/profile-form.test.tsx` — perfil autenticado.
- Read: `src/components/groups/groups-content.tsx`, `src/components/groups/create-group-form.tsx` y sus pruebas — grupos compartidos.
- Read: `src/components/accounts/accounts-content.tsx`, `src/app/cuentas/page.tsx` y `supabase/migrations/20260828090000_accounts.sql` — cuentas personales.
- Read: `src/components/movements/movements-content.tsx`, `src/components/movements/create-movement-form.tsx` y `supabase/migrations/20260827100000_movements.sql` — movimientos autorizados.
- Create: `.superpowers/sdd/four-module-audit-report.md` — evidencia operativa no funcional de la auditoría.

### Task 1: Auditar perfil y grupos

**Files:**
- Read: `src/components/profile/profile-form.tsx`
- Read: `src/components/groups/groups-content.tsx`
- Read: `src/components/groups/create-group-form.tsx`
- Read: `tests/unit/profile-form.test.tsx`
- Read: `tests/unit/groups-content.test.tsx`
- Read: `tests/unit/create-group-form.test.tsx`

**Interfaces:**
- Consumes: `profiles.display_name`, `create_shared_group(group_name text)` y las lecturas RLS de `financial_spaces` con `kind = 'shared'`.
- Produces: evidencia de que perfil solo escribe el nombre propio y grupos crea/lista únicamente grupos autorizados.

- [ ] **Step 1: Revisar el flujo de perfil.**

Confirmar que obtiene el usuario mediante `auth.getUser()`, lee `profiles.display_name` por el mismo `user.id`, valida el nombre tras `trim()` y actualiza únicamente `{ display_name }` filtrado por ese identificador.

- [ ] **Step 2: Revisar el flujo de grupos.**

Confirmar que la creación usa `rpc("create_shared_group", { group_name })`, que el listado consulta únicamente `financial_spaces` con `kind = "shared"` y que los estados de carga, vacío, error y reintento no exponen espacios personales.

- [ ] **Step 3: Ejecutar las pruebas focalizadas.**

Run: `corepack pnpm test tests/unit/profile-form.test.tsx tests/unit/groups-content.test.tsx tests/unit/create-group-form.test.tsx`

Expected: todas las pruebas finalizan con código `0`; registrar cualquier aviso sin cambiar configuración.

### Task 2: Auditar cuentas y movimientos

**Files:**
- Read: `src/components/accounts/accounts-content.tsx`
- Read: `src/app/cuentas/page.tsx`
- Read: `src/components/movements/movements-content.tsx`
- Read: `src/components/movements/create-movement-form.tsx`
- Read: `tests/unit/create-movement-form.test.tsx`
- Read: `supabase/migrations/20260828090000_accounts.sql`
- Read: `supabase/migrations/20260827100000_movements.sql`

**Interfaces:**
- Consumes: cuenta `{ space_id, name, currency, initial_balance }` y movimiento `{ space_id, created_by, kind, amount, occurred_on, category }`.
- Produces: evidencia de que cuentas se crean en el espacio personal y movimientos se limitan a pertenencias visibles y entradas válidas.

- [ ] **Step 1: Revisar cuentas contra la migración.**

Confirmar que la interfaz localiza solo el espacio `kind = "personal"`, inserta `space_id`, `name`, `currency` e `initial_balance`, y que la migración restringe select/insert al espacio personal creado por `auth.uid()`.

- [ ] **Step 2: Revisar movimientos contra la migración.**

Confirmar que el formulario exige espacio, tipo, monto positivo y categoría no vacía; que usa el usuario autenticado para `created_by`; y que la migración exige membresía tanto para lectura como para inserción.

- [ ] **Step 3: Ejecutar la prueba focalizada.**

Run: `corepack pnpm test tests/unit/create-movement-form.test.tsx`

Expected: termina con código `0`; registrar el resultado sin modificar código.

### Task 3: Consolidar la auditoría y delimitar correcciones

**Files:**
- Create: `.superpowers/sdd/four-module-audit-report.md`
- Read: resultados de Tasks 1 y 2.

**Interfaces:**
- Consumes: evidencia estática y resultados focalizados de los cuatro módulos.
- Produces: estado `aprobado` o una única primera categoría que requiera especificación de corrección.

- [ ] **Step 1: Registrar un resultado por módulo.**

Para perfil, grupos, cuentas y movimientos registrar: interfaz inspeccionada, frontera RLS confirmada, estados de UI observados y resultado de prueba.

- [ ] **Step 2: Clasificar hallazgos.**

Si surge un fallo, asignarlo a un único módulo y describir el comportamiento observable, archivo responsable y prueba de regresión necesaria. No modificar archivos de aplicación.

- [ ] **Step 3: Determinar el siguiente paso.**

Si no hay fallos, registrar que los cuatro módulos están listos para una prueba manual autenticada. Si hay un fallo, proponer únicamente la especificación focalizada del primer módulo afectado y esperar aprobación del usuario.

## Plan Self-Review

- **Spec coverage:** las tareas 1 y 2 cubren cada módulo y sus límites de autorización; la tarea 3 impide mezclar correcciones.
- **Placeholder scan:** todos los comandos, archivos e interfaces son concretos; no se crean cambios de aplicación durante la auditoría.
- **Type consistency:** los campos de cuentas y movimientos coinciden con sus migraciones y las llamadas de perfil y grupos conservan sus interfaces actuales.
