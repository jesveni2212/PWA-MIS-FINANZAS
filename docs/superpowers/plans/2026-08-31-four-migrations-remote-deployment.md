# Four Migrations Remote Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verificar y, con autorización posterior al dry-run, desplegar exactamente cuatro migraciones locales en el proyecto Supabase enlazado.

**Architecture:** Supabase CLI compara los archivos locales con la tabla remota `supabase_migrations.schema_migrations`. Las consultas de historial y el dry-run no escriben en remoto; solo un `db push --linked` posterior, revisado y autorizado, aplica las migraciones pendientes en orden.

**Tech Stack:** Supabase CLI vía `npx supabase@latest`, PostgreSQL alojado por Supabase, Docker opcional para pgTAP.

## Global Constraints

- El único destino remoto permitido es el proyecto ya enlazado `liouotvuemrtnpbkeszq`.
- No imprimir, almacenar ni confirmar tokens, contraseñas ni valores de `.env.local`.
- El conjunto esperado es `20260821`, `20260827090000`, `20260827100000` y `20260828090000`, en ese orden.
- No usar `migration repair`, `db pull`, `db reset`, `--include-all` ni `--include-seed`.
- No ejecutar `db push` sin una aprobación explícita de la persona usuaria después de revisar el dry-run.
- Detenerse ante falta de salida, solicitud interactiva, error de red o discrepancia de historial; no probar alternativas que escriban en remoto.

---

### Task 1: Confirmar las precondiciones y el historial remoto

**Files:**
- Verify: `supabase/migrations/20260821_identity_security.sql`
- Verify: `supabase/migrations/20260827090000_shared_groups.sql`
- Verify: `supabase/migrations/20260827100000_movements.sql`
- Verify: `supabase/migrations/20260828090000_accounts.sql`
- Modify: none.

**Interfaces:**
- Consumes: configuración local existente de Supabase y los cuatro archivos de migración.
- Produces: tabla de comparación local/remota sin cambios de base de datos.

- [ ] **Step 1: Confirmar el inventario local ordenado.**

Run: `Get-ChildItem supabase/migrations -File | Sort-Object Name | Select-Object -ExpandProperty Name`

Expected: los cuatro nombres exactos del conjunto esperado, sin una versión duplicada.

- [ ] **Step 2: Confirmar que las variables públicas requeridas existen sin imprimirlas.**

Run: `$configured = Get-Content .env.local | Where-Object { $_ -match '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)=' } | ForEach-Object { [bool]($_.Split('=', 2)[1].Trim()) }; $configured.Count -eq 2 -and ($configured -notcontains $false)`

Expected: `True`. Si el resultado es `False`, detenerse sin invocar el CLI remoto.

- [ ] **Step 3: Leer el historial remoto.**

Run: `npx.cmd supabase@latest migration list --linked`

Expected: una tabla que muestre las cuatro versiones locales y ninguna versión remota inesperada. Si no termina o solicita interacción, detener el proceso sin ejecutar el dry-run.

- [ ] **Step 4: Clasificar el historial.**

Expected: continuar únicamente si las cuatro versiones aparecen como locales pendientes y no hay filas remotas adicionales. En cualquier otro caso, capturar el diagnóstico no sensible y detenerse.

### Task 2: Previsualizar el despliegue sin escritura

**Files:**
- Verify: los cuatro archivos de `supabase/migrations/` del Task 1.
- Modify: none.

**Interfaces:**
- Consumes: historial remoto validado del Task 1.
- Produces: lista revisable de migraciones que `db push` aplicaría.

- [ ] **Step 1: Ejecutar la previsualización.**

Run: `npx.cmd supabase@latest db push --linked --dry-run`

Expected: salida que enumere exclusivamente `20260821_identity_security.sql`, `20260827090000_shared_groups.sql`, `20260827100000_movements.sql` y `20260828090000_accounts.sql` en orden. El comando no debe modificar el remoto.

- [ ] **Step 2: Verificar el conjunto previsualizado.**

Expected: los cuatro nombres y versiones coinciden con el inventario local. Si falta, sobra, se reordena una migración o el comando no produce salida verificable, detenerse sin ejecutar `db push`.

- [ ] **Step 3: Solicitar aprobación explícita del despliegue.**

Expected: mostrar el resultado de la previsualización y esperar una autorización inequívoca antes de continuar al Task 3.

### Task 3: Aplicar solo el conjunto aprobado y confirmarlo

**Files:**
- Verify: los cuatro archivos de `supabase/migrations/` del Task 1.
- Modify: esquema y tabla de historial del proyecto remoto únicamente mediante Supabase CLI.

**Interfaces:**
- Consumes: aprobación explícita posterior al dry-run del Task 2.
- Produces: las cuatro migraciones registradas como aplicadas en el historial remoto.

- [ ] **Step 1: Aplicar el conjunto previsualizado.**

Run: `npx.cmd supabase@latest db push --linked`

Expected: cada una de las cuatro migraciones termina correctamente. Si falla, capturar el mensaje no sensible y no ejecutar repair, pull, reset ni reintentos con banderas adicionales.

- [ ] **Step 2: Confirmar el historial posterior.**

Run: `npx.cmd supabase@latest migration list --linked`

Expected: las cuatro versiones tienen una entrada local y una remota correspondiente, sin otras diferencias.

- [ ] **Step 3: Registrar el resultado sin secretos.**

Modify: `.superpowers/sdd/task-3-report.md`

Append una sección fechada con el conjunto aplicado, el resultado de la comparación posterior y cualquier bloqueo, sin credenciales ni datos financieros.

- [ ] **Step 4: Confirmar el cambio documental.**

Run: `git diff --check -- .superpowers/sdd/task-3-report.md; git status --short`

Expected: no hay errores de espacios y el informe es el único archivo modificado por este paso.

### Task 4: Ejecutar la verificación local de autorización cuando sea posible

**Files:**
- Verify: `supabase/tests/shared_groups_security.sql`
- Verify: `supabase/tests/movements_security.sql`
- Modify: none.

**Interfaces:**
- Consumes: Docker y una pila local de Supabase disponibles.
- Produces: evidencia de las políticas de grupos y movimientos, o una limitación documentada si Docker no está disponible.

- [ ] **Step 1: Detectar Docker sin instalarlo.**

Run: `docker version --format '{{.Server.Version}}'`

Expected: una versión de servidor. Si el comando falla, documentar que las suites pgTAP no se ejecutaron y no instalar Docker.

- [ ] **Step 2: Iniciar la pila local solo si Docker respondió.**

Run: `npx.cmd supabase@latest start`

Expected: servicios locales sanos y las cuatro migraciones aplicadas localmente.

- [ ] **Step 3: Ejecutar las suites pgTAP existentes.**

Run: `npx.cmd supabase@latest test db supabase/tests/shared_groups_security.sql; npx.cmd supabase@latest test db supabase/tests/movements_security.sql`

Expected: ambas suites terminan correctamente. Si una falla, registrar la aserción y no cambiar SQL sin una nueva especificación de corrección.

## Plan Self-Review

- **Spec coverage:** Tasks 1 y 2 cubren inspección y previsualización; Task 3 limita y confirma la única escritura remota; Task 4 cubre la verificación local opcional.
- **Placeholder scan:** las cuatro versiones, comandos, condiciones de parada y resultados esperados son concretos.
- **Type consistency:** no se agregan interfaces de aplicación ni tipos; la fuente local y el historial remoto usan las mismas cuatro versiones.
