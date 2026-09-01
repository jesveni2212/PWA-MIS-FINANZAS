# Profile Column Update Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restringir las actualizaciones autenticadas de perfiles a `display_name` y comprobarlo con pgTAP.

**Architecture:** Una migración nueva sustituye el privilegio general de actualización por un privilegio de columna; RLS mantiene el control de filas. Una prueba de base de datos verifica el caso permitido y el rechazado.

**Tech Stack:** PostgreSQL 17, Supabase migrations, pgTAP.

## Global Constraints

- No cambiar el formulario, RLS existente, credenciales ni usar RPCs.
- No desplegar remoto sin dry-run verificable y aprobación explícita.
- No exponer valores de `.env.local`.

### Task 1: Restringir el privilegio de perfiles

**Files:**
- Create: `supabase/migrations/20260831140000_profiles_display_name_update_only.sql`

**Interfaces:**
- Consumes: `public.profiles` y el rol `authenticated`.
- Produces: `UPDATE (display_name)` como único permiso de actualización del rol.

- [ ] **Step 1: Escribir la migración.**

```sql
revoke update on table public.profiles from authenticated;
grant update (display_name) on table public.profiles to authenticated;
```

- [ ] **Step 2: Verificar el contenido.**

Run: `Get-Content -Raw supabase/migrations/20260831140000_profiles_display_name_update_only.sql`

Expected: contiene exactamente la revocación y concesión por columna, sin modificar RLS.

### Task 2: Probar privilegios de columna

**Files:**
- Create: `supabase/tests/profiles_security.sql`

**Interfaces:**
- Consumes: rol `authenticated`, JWT `request.jwt.claim.sub` y perfiles de prueba.
- Produces: una aserción de actualización permitida y otra que falla por privilegio.

- [ ] **Step 1: Crear la suite pgTAP.**

La prueba inserta un usuario/perfil de prueba, asume `authenticated`, configura su `sub`, usa `lives_ok` para `update public.profiles set display_name = 'Ana P.' where id = ...` y `throws_ok` para `update public.profiles set email = 'otro@example.com' where id = ...`, esperando SQLSTATE `42501`.

- [ ] **Step 2: Ejecutar la suite local si Docker está disponible.**

Run: `npx.cmd supabase@latest test db supabase/tests/profiles_security.sql`

Expected: ambas aserciones pasan; si Docker no está disponible, registrar el bloqueo sin instalarlo.

### Task 3: Validar y preparar despliegue seguro

**Files:**
- Verify: `supabase/migrations/20260831140000_profiles_display_name_update_only.sql`
- Verify: `supabase/tests/profiles_security.sql`

- [ ] **Step 1: Ejecutar `corepack pnpm lint; corepack pnpm typecheck; corepack pnpm test; corepack pnpm build`.**

Expected: todos terminan con código `0`.

- [ ] **Step 2: Ejecutar `npx.cmd supabase@latest db push --linked --dry-run`.**

Expected: enumera únicamente la nueva migración. Detenerse y solicitar autorización explícita antes de `db push`.

## Plan Self-Review

- La migración elimina el privilegio amplio; la suite cubre el caso permitido y denegado; no se mezcla un despliegue sin aprobación.
