# Task 3 — Ajustar navegación, comprobar y documentar

Fecha: 2026-08-26

## Resultado

Task 3 quedó implementada. El shell público ya no expone el enlace `Inicio` en su navegación inferior y conserva únicamente `Acceso` y `Registro`. La portada mantiene sus CTA de inicio de sesión y registro. Las rutas privadas `/perfil`, `/movimientos` y `/grupos` quedan cubiertas por pruebas E2E que verifican redirección a `/acceso` con un parámetro `next` interno y exacto.

No se agregaron credenciales de Supabase, usuarios, sesiones ni llamadas de autenticación.

## Comandos y resultados

- `node_modules\\.bin\\eslint.cmd .` — código 0.
- `node_modules\\.bin\\tsc.cmd --noEmit --incremental false` — código 0.
- `node_modules\\.bin\\vitest.cmd run` — código 0; 7 archivos y 12 pruebas pasaron.
- `node_modules\\.bin\\next.cmd build` — código 0; compilación, TypeScript, generación estática y optimización completadas.
- `node_modules\\.bin\\playwright.cmd test` — código 0; 12 pruebas pasaron en escritorio y iPhone emulado.

Avisos observados, sin impacto: advertencia de configuración nativa futura de Vite, `NO_COLOR` ignorado por `FORCE_COLOR`, sistema de archivos lento y bloqueo de recursos dev cross-origin para `127.0.0.1`. Ninguno produjo fallo.

## Archivos modificados

- `src/components/app-shell.tsx`: filtra el enlace raíz `/` de la navegación pública.
- `tests/unit/app-shell.test.tsx`: verifica Acceso/Registro y la ausencia de Inicio.
- `tests/e2e/public-navigation.spec.ts`: ajusta los nombres visibles de los CTA y añade cobertura de las tres redirecciones protegidas con `next` interno.
- `docs/implementation-phases.md`: registra el cierre y la evidencia de verificación de la tarea.

Se preservaron fuera del commit los cambios locales ajenos en `tsconfig.tsbuildinfo`, `docs/superpowers/plans/2026-08-19-phase-1-foundations.md` y `docs/superpowers/plans/2026-08-20-phase-1-modern-foundations.md`.

## Auto-revisión

- El contrato de navegación pública coincide con la fase anónima: acceso y registro son las únicas acciones del shell.
- Las pruebas no dependen de credenciales ni de un backend Supabase.
- `next` se compara mediante `URLSearchParams` y se exige que sea exactamente una ruta interna esperada.
- El proxy existente sigue siendo un redirect optimista; la autorización real queda para el servidor cuando Supabase se configure.
- No se incluyeron archivos generados ni cambios no relacionados.

## Commit

Creado con el asunto solicitado: `feat: add auth UI without Supabase`; el SHA final se entrega junto con este reporte.




## Revisión posterior — ajuste de layout — 2026-08-26

- Hallazgo atendido: la navegación pública tenía `grid-cols-3` aunque solo renderiza Acceso y Registro, dejando una celda vacía.
- Cambio: `src/components/app-shell.tsx` usa ahora `grid-cols-2`, de modo que ambas acciones ocupan correctamente la fila.
- Verificación: `node_modules\\.bin\\vitest.cmd run tests/unit/app-shell.test.tsx` — código 0, 1 archivo y 1 prueba pasada.
- Verificación: `node_modules\\.bin\\playwright.cmd test tests/e2e/public-navigation.spec.ts` — código 0, 8 pruebas pasadas en escritorio y iPhone emulado.
- Avisos: permanecen advertencias no bloqueantes del servidor dev sobre `NO_COLOR`/`FORCE_COLOR` y recursos cross-origin para `127.0.0.1`; no afectan las pruebas.
- Auto-revisión: el número de columnas ahora coincide con el número de acciones; no se modificaron rutas, lógica de autorización, credenciales ni archivos locales ajenos.
