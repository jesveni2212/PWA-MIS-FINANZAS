# Estabilización de calidad local Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verificar la calidad de todos los cambios locales y producir una línea base reproducible antes de corregir fallos por módulo.

**Architecture:** Los comandos de calidad se ejecutan sin modificar código de aplicación. Sus resultados se registran y se clasifican por configuración compartida o por el módulo responsable; un fallo que requiera cambios de comportamiento abre una especificación y plan focalizados antes de editar código.

**Tech Stack:** Next.js 16.3.1, React 19, TypeScript 5, ESLint 9, Vitest 4, pnpm 11.

## Global Constraints

- No añadir dependencias ni editar configuración para ocultar errores.
- Usar Next.js App Router y mantener `typescript.ignoreBuildErrors` desactivado.
- No ejecutar comandos que alteren el proyecto remoto de Supabase.
- No exponer variables de `.env.local` ni datos financieros en el informe.
- Tratar `next-env.d.ts`, `.next` y `tsconfig.tsbuildinfo` como artefactos generados; no editarlos manualmente.

---

### Task 1: Capturar la línea base de calidad

**Files:**
- Modify: `.superpowers/sdd/task-3-report.md` solo si ya existe un informe de calidad local; en otro caso, no modificar archivos.

**Interfaces:**
- Consumes: scripts `lint`, `typecheck`, `test` y `build` definidos en `package.json`.
- Produces: resultado con código de salida y diagnóstico por cada comando.

- [ ] **Step 1: Inspeccionar los scripts y la configuración de validación.**

Run: `Get-Content -Raw package.json; Get-Content -Raw eslint.config.mjs; Get-Content -Raw tsconfig.json; Get-Content -Raw vitest.config.ts`

Expected: los scripts resuelven respectivamente a `eslint .`, `tsc --noEmit`, `vitest run` y `next build`.

- [ ] **Step 2: Ejecutar el linter.**

Run: `corepack pnpm lint`

Expected: código 0; si falla, conservar el texto exacto de cada archivo, regla y línea informados.

- [ ] **Step 3: Ejecutar el chequeo de tipos.**

Run: `corepack pnpm typecheck`

Expected: código 0; si falla, conservar el símbolo, archivo y línea de cada diagnóstico de TypeScript.

- [ ] **Step 4: Ejecutar las pruebas unitarias.**

Run: `corepack pnpm test`

Expected: código 0; si falla, conservar el nombre de cada prueba y su aserción fallida.

- [ ] **Step 5: Construir la aplicación de producción.**

Run: `corepack pnpm build`

Expected: código 0 y rutas de App Router compiladas; si falla, conservar la fase y el diagnóstico reportado por Next.js.

- [ ] **Step 6: Revisar el árbol de trabajo.**

Run: `git status --short`

Expected: identificar por separado los cambios funcionales preexistentes y los artefactos generados por las validaciones.

### Task 2: Clasificar y delimitar cualquier corrección

**Files:**
- Create: `docs/superpowers/specs/YYYY-MM-DD-<modulo>-quality-fix-design.md` únicamente si el Task 1 identifica un fallo que requiere modificar comportamiento o configuración.
- Create: `docs/superpowers/plans/YYYY-MM-DD-<modulo>-quality-fix.md` únicamente después de aprobar su especificación.

**Interfaces:**
- Consumes: diagnósticos concretos del Task 1.
- Produces: una corrección aislada por módulo, con prueba de regresión y verificación enfocada.

- [ ] **Step 1: Asignar cada diagnóstico a una sola categoría.**

Clasificar cada error como `configuración`, `autenticación`, `perfil`, `cuentas`, `movimientos` o `grupos`. Un mismo diagnóstico no debe figurar en más de una categoría.

- [ ] **Step 2: Separar errores que no requieren cambio de código.**

Marcar como artefacto generado los cambios de `.next`, `next-env.d.ts` y `tsconfig.tsbuildinfo` que hayan sido producidos por los comandos, sin editar esos archivos.

- [ ] **Step 3: Abrir una especificación focalizada por la primera categoría con errores funcionales.**

La especificación debe fijar el comportamiento observable, el archivo responsable, los estados de error y la prueba de regresión. No agrupar dos módulos en una misma especificación.

- [ ] **Step 4: Esperar la aprobación del usuario de la especificación focalizada.**

Expected: aprobación explícita antes de escribir un plan de corrección o cambiar código, conforme a la guía de brainstorming.

- [ ] **Step 5: Crear el plan de corrección focalizado y ejecutarlo con ciclo TDD.**

El plan debe contener una prueba inicialmente fallida que reproduzca el diagnóstico, la implementación mínima para hacerla pasar, la prueba enfocada y un commit limitado a esa corrección.

### Task 3: Cerrar la fase local

**Files:**
- Modify: solo los archivos necesarios para correcciones aprobadas en los planes focalizados.

**Interfaces:**
- Consumes: resultados de Task 1 y las correcciones aprobadas de Task 2.
- Produces: control de calidad completo aprobado o un informe exacto de los fallos aún pendientes.

- [ ] **Step 1: Repetir los cuatro controles de calidad después de cada corrección aprobada.**

Run: `corepack pnpm lint; corepack pnpm typecheck; corepack pnpm test; corepack pnpm build`

Expected: los cuatro comandos finalizan con código 0.

- [ ] **Step 2: Confirmar que no se ocultaron errores.**

Run: `Get-Content -Raw next.config.ts; Get-Content -Raw tsconfig.json`

Expected: `typescript.ignoreBuildErrors` no está habilitado y `noEmit` permanece en `true`.

- [ ] **Step 3: Inspeccionar el estado final.**

Run: `git status --short`

Expected: cada cambio funcional tiene una causa observada y una prueba asociada; los artefactos generados no se editan ni se incluyen como solución.

- [ ] **Step 4: Documentar el resultado y proponer la fase remota.**

El informe debe enumerar los cuatro códigos de salida, los cambios intencionales y cualquier bloqueo. La siguiente fase deberá abordar Supabase con una especificación independiente y sin ejecutar un `db push` hasta disponer de un dry-run verificable.

## Plan Self-Review

- **Spec coverage:** la línea base está cubierta por Task 1; la clasificación y el límite de cambios por módulo, por Task 2; la repetición y el cierre verificable, por Task 3.
- **Placeholder scan:** no hay pasos de implementación sin una condición o resultado explícitos; las rutas con fecha variable solo se crean si existe un diagnóstico concreto.
- **Type consistency:** la fase usa los scripts existentes sin introducir interfaces o tipos nuevos.
