# Origen de desarrollo para Playwright

## Objetivo

Eliminar los avisos de origen cruzado de Next.js durante las pruebas E2E ejecutadas en `127.0.0.1`.

## Diseño

La aplicación conserva `http://127.0.0.1:3000` como `baseURL` de Playwright y añade únicamente `127.0.0.1` a `allowedDevOrigins` en `next.config.ts`. La opción se aplica al servidor de desarrollo; no modifica rutas, autenticación, políticas de Supabase ni comportamiento de producción.

## Verificación

Se ejecutará `corepack pnpm test:e2e` y se comprobará que las doce pruebas terminan con código 0 sin avisos de origen bloqueado. Las pruebas existentes permanecen sin cambios.

## Alcance excluido

No se permite ningún comodín, dominio externo ni cambio en `playwright.config.ts`.

## Revisión propia

- El único origen adicional es el que ya usa el runner local.
- La configuración coincide con la documentación instalada de Next.js 16.3.1.
- No hay pasos pendientes ni ambigüedad de alcance.
