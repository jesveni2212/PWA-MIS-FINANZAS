# Estabilización de calidad local — Diseño

## Objetivo

Establecer una línea base confiable para los cambios locales existentes antes de
continuar con nuevas funcionalidades o con operaciones remotas de Supabase.

## Alcance

La fase ejecutará lint, verificación de tipos, pruebas unitarias y build. Los
fallos se clasificarán por su causa y se corregirán módulo a módulo:
autenticación, perfil, cuentas, movimientos y grupos.

Las migraciones remotas no forman parte de esta fase. No se ejecutará un push,
repair, reset, pull ni otra operación que altere el proyecto remoto de
Supabase.

## Diseño

La validación inicial no modifica el código de aplicación: su función es
producir evidencia de los fallos actuales. Cada fallo se asignará a un único
módulo o a la configuración compartida, evitando combinar cambios sin relación.

Cada corrección seguirá un ciclo pequeño y verificable: definir o ajustar la
prueba que describe el comportamiento, aplicar el cambio mínimo en el módulo
responsable, ejecutar la prueba enfocada y luego repetir los controles globales
al terminar el conjunto de correcciones.

## Límites técnicos

- Se conserva Next.js App Router y las convenciones de Next.js 16.3.1.
- No se añaden dependencias.
- Las validaciones de TypeScript se ejecutan mediante `tsc --noEmit`; no se
  omiten errores de producción.
- Se preservan autenticación obligatoria, autorización del lado servidor y RLS
  como límites de acceso a datos.
- No se exponen valores de `.env.local` ni datos financieros en salidas o logs.

## Criterios de aceptación

- `corepack pnpm lint` finaliza con código 0.
- `corepack pnpm typecheck` finaliza con código 0.
- `corepack pnpm test` finaliza con código 0.
- `corepack pnpm build` finaliza con código 0.
- Los cambios resultantes están limitados a causas observadas y acompañados por
  pruebas pertinentes cuando se modifica comportamiento.

## Riesgos y tratamiento

Los artefactos generados por Next.js y TypeScript pueden cambiar durante las
validaciones. No se tratarán como cambios funcionales ni se editarán a mano;
se confirmará su condición antes del cierre de la fase.

Los comandos que contacten Supabase pueden requerir una sesión interactiva o
red. Esos comandos se posponen para la fase remota y no bloquean la corrección
local.

## Revisión propia

- Sin marcadores pendientes ni requisitos ambiguos.
- El alcance se limita a una sola fase verificable.
- Los criterios de aceptación se corresponden con los comandos definidos en el
  proyecto.
