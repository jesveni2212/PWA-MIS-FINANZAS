# Local Supabase Ports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Iniciar Supabase local fuera de los puertos reservados por Windows.

**Architecture:** Se conservan todos los servicios de Supabase y se cambia solo
su mapeo de puertos del host en `supabase/config.toml`. La ejecución se hace
desde Ubuntu/WSL, donde Docker Desktop está integrado.

**Tech Stack:** Supabase CLI, Docker Desktop, WSL 2, pgTAP.

## Global Constraints

- No modificar migraciones, datos remotos ni rangos reservados de Windows.
- Usar los puertos `55020–55029` exclusivamente para la pila local.
- Ejecutar los comandos de Supabase desde Ubuntu/WSL.

---

### Task 1: Reasignar y validar puertos locales

**Files:**
- Modify: `supabase/config.toml`
- Test: `supabase/tests/shared_groups_security.sql`
- Test: `supabase/tests/movements_security.sql`

**Interfaces:**
- Consumes: Docker Desktop integrado con Ubuntu y la reserva de Windows que
  bloquea `54242–54341`.
- Produces: una pila local disponible en el puerto de base de datos `55022`.

- [ ] **Step 1: Cambiar las siete asignaciones de puertos.**

En `supabase/config.toml`, establecer:

```toml
[api]
port = 55021

[db]
port = 55022
shadow_port = 55020

[db.pooler]
port = 55029

[studio]
port = 55023

[local_smtp]
port = 55024

[analytics]
port = 55027
```

- [ ] **Step 2: Iniciar la pila local.**

Run:

```bash
cd '/mnt/d/PROYECTO WEB AGENTE/PWA MIS FINANZAS'
npx supabase@latest start
```

Expected: la base de datos inicia y el resumen muestra la URL API en el puerto
`55021` y la URL DB en el puerto `55022`.

- [ ] **Step 3: Ejecutar las suites pgTAP.**

Run:

```bash
npx supabase@latest test db supabase/tests/shared_groups_security.sql
npx supabase@latest test db supabase/tests/movements_security.sql
```

Expected: ambas suites terminan con código `0`.

- [ ] **Step 4: Revisar el cambio intencional.**

Run:

```powershell
git diff -- supabase/config.toml
```

Expected: solo aparecen las siete sustituciones de puertos locales.

## Self-Review

- Spec coverage: el único requisito, evitar puertos reservados, se implementa
  en la Tarea 1 y se valida con inicio local y pgTAP.
- Placeholder scan: no hay marcadores ni pasos indefinidos.
- Type consistency: no se añaden interfaces ni tipos de aplicación.
