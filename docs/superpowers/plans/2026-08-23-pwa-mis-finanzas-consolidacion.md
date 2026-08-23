# Consolidación de PWA MIS FINANZAS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar `PWA MIS FINANZAS - fase 2` en `PWA MIS FINANZAS` y eliminar la carpeta externa.

**Architecture:** La carpeta principal seguirá siendo el único repositorio y punto de ejecución. Los archivos exclusivos de fase 2 se trasladarán a su misma ruta relativa y cada archivo coincidente se comparará antes de integrar los avances.

**Tech Stack:** Next.js 16, React 19, TypeScript, pnpm 11, Vitest, Playwright y Supabase.

## Global Constraints

- El resultado debe quedar íntegramente dentro de `PWA MIS FINANZAS`.
- No crear ni conservar una copia de respaldo.
- No sobrescribir archivos coincidentes sin comparar su contenido.
- Validar con lint, typecheck, test y build desde la carpeta principal.
- No incorporar secretos; solo `.env.example` puede versionarse.

---

### Task 1: Inventariar y resolver las diferencias

**Files:**
- Read: `PWA MIS FINANZAS/**`
- Read: `PWA MIS FINANZAS - fase 2/**`
- Modify: este plan, con las decisiones de cada archivo conflictivo.

**Interfaces:**
- Consumes: ambos árboles de archivos.
- Produces: rutas clasificadas como exclusivas, idénticas o conflictivas.

- [ ] **Step 1: Excluir artefactos generados**

No considerar `node_modules`, `.next`, `test-results`, `.git` ni archivos locales de entorno como parte de la integración.

- [ ] **Step 2: Comparar las rutas funcionales**

Clasificar los archivos fuente, pruebas, configuración, recursos y migraciones. Para una ruta presente en ambas carpetas, comparar contenido y anotar la resolución aplicada.

- [ ] **Step 3: Revisar las configuraciones comunes**

Resolver explícitamente `package.json`, `pnpm-lock.yaml`, `.env.example`, `src/**`, `tests/**` y `supabase/**`. Confirmar que las nuevas dependencias de Supabase corresponden a importaciones reales.

### Task 2: Integrar fase 2 en la carpeta principal

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`, `.env.example` y archivos coincidentes aceptados.
- Create/Modify: `src/**`, `tests/**`, `public/**`, `supabase/**`, `.github/**` y documentación exclusiva de fase 2.

**Interfaces:**
- Consumes: clasificación de Task 1.
- Produces: una única aplicación Next.js con las funciones de fase 2.

- [ ] **Step 1: Mover archivos exclusivos**

Mover cada archivo funcional exclusivo de fase 2 a la ruta equivalente en `PWA MIS FINANZAS`, creando sus directorios cuando sea necesario.

- [ ] **Step 2: Aplicar las fusiones**

Incorporar los cambios revisados de los archivos coincidentes. Conservar los scripts existentes de `package.json`; añadir `@supabase/ssr` y `@supabase/supabase-js` solo si los módulos incorporados los importan.

- [ ] **Step 3: Proteger el entorno**

Incorporar a `.env.example` únicamente nombres de variables y valores de ejemplo. No copiar `.env.local` ni otros archivos con secretos.

- [ ] **Step 4: Sincronizar dependencias**

Ejecutar desde `PWA MIS FINANZAS`:

    corepack pnpm install --frozen-lockfile

Expected: exit code 0.

### Task 3: Verificar y retirar la carpeta externa

**Files:**
- Modify: `docs/implementation-phases.md`, si existe.
- Delete: `D:\PROYECTO WEB AGENTE\PWA MIS FINANZAS - fase 2`.

**Interfaces:**
- Consumes: la aplicación consolidada.
- Produces: un único proyecto verificable dentro de la carpeta principal.

- [ ] **Step 1: Ejecutar calidad y pruebas**

Ejecutar desde `PWA MIS FINANZAS`:

    corepack pnpm lint
    corepack pnpm typecheck
    corepack pnpm test
    corepack pnpm build

Expected: los cuatro comandos terminan con exit code 0.

- [ ] **Step 2: Actualizar el registro de fase**

Si existe `docs/implementation-phases.md`, anotar que fase 2 se integró en la carpeta principal y las verificaciones realizadas.

- [ ] **Step 3: Eliminar fase 2**

Después de confirmar que sus rutas funcionales ya existen en el repositorio principal, eliminar `PWA MIS FINANZAS - fase 2` sin conservar respaldo.

- [ ] **Step 4: Registrar el resultado en Git**

Ejecutar desde `PWA MIS FINANZAS`:

    git add --all
    git commit -m "feat: consolidate phase 2 into PWA Mis Finanzas"

Expected: un commit en el repositorio principal que contenga la integración.

## Self-review

- Cobertura: inventario, comparación, fusión, verificación y eliminación se corresponden con la especificación.
- Consistencia: las comprobaciones se hacen antes de eliminar la carpeta externa.
