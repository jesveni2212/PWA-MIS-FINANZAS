# Fases de implementación — Mis Finanzas

**Estado general:** diseño aprobado; implementación aún no iniciada.

Este documento es el registro vivo del proyecto. Al finalizar cada fase se
actualizarán estado, fecha, entregables, decisiones, pruebas ejecutadas,
riesgos y pendientes.

| Fase | Estado | Objetivo | Evidencia de cierre |
| --- | --- | --- | --- |
| 1. Fundaciones | Pendiente | Repositorio, estándares, PWA base, CI y despliegue automatizado. | Build, lint, tipado, instalación PWA y pipeline verde. |
| 2. Identidad y seguridad | Pendiente | Auth.js con correo/contraseña, Google y Apple; aislamiento de datos. | Flujos de acceso y pruebas de autorización. |
| 3. Finanzas personales | Pendiente | Cuentas PYG/USD, movimientos, categorías, gastos fijos, deudas, dashboard y búsqueda. | Cálculos y filtros probados. |
| 4. Captura y recordatorios | Pendiente | Alta rápida, OCR temporal sin imágenes persistidas y Web Push. | Confirmación OCR, suscripción y entrega de prueba. |
| 5. Finanzas compartidas | Pendiente | Grupos, roles, repartos, balances y liquidaciones manuales. | Balances y permisos verificados. |
| 6. Calidad y publicación | Pendiente | Accesibilidad, seguridad, backups, monitoreo, dominio y pruebas reales. | Checklist de producción aprobado. |
| 7. Ruta de escalamiento | Pendiente | Preparar migración de servicios administrados a VPS. | Runbook de migración revisado. |

## Registro de avances

### Pre-fase — 2026-08-19

- Se definió una PWA responsive para iPhone y escritorio, inicialmente para un
  máximo aproximado de diez usuarios.
- Se aprobó Next.js/React/TypeScript en Vercel, PostgreSQL administrado y
  Auth.js; la arquitectura conserva una ruta de migración futura a VPS.
- Se definieron PYG y USD, autenticación por correo/contraseña, Google y Apple,
  espacios personales/compartidos, reparto de gastos y liquidaciones manuales.
- Se definieron búsqueda avanzada, adjuntos no persistentes para OCR y
  notificaciones push con permiso explícito.
- Pendiente: revisión del diseño y planificación detallada de la Fase 1.

### Checkpoint de Fase 1 — 2026-08-20

#### Realizado

- Se inicializó el repositorio Git local y se seleccionó la rama `main`. Aún
  no existe ningún commit.
- Se generó la base de Next.js en una carpeta temporal compatible y se movió a
  la raíz del proyecto. `LOGO.JPG` se mantuvo intacto.
- Se creó la estructura inicial: `src/`, `public/`, `package.json`,
  `tsconfig.json`, configuraciones de Next.js, Tailwind, PostCSS y ESLint,
  `README.md`, `.gitignore`, `.env.example` y `pnpm-lock.yaml`.
- Se añadieron las herramientas de pruebas y sus archivos de configuración:
  Vitest, Testing Library, Playwright, `tests/`, `vitest.config.ts` y
  `playwright.config.ts`.
- Se creó el directorio interno `.superpowers/sdd/` para los reportes de la
  ejecución delegada. No forma parte del producto.
- Se documentaron el diseño, el contexto maestro, las reglas de ingeniería y
  el plan detallado de la Fase 1.

#### Bloqueos y decisiones resueltas

- Windows no permitió habilitar `pnpm` globalmente mediante `corepack enable`.
  Se decidió utilizar `corepack pnpm` sin instalación global; la versión
  verificada es 11.8.0.
- El generador de Next.js rechazó una carpeta temporal que iniciaba con punto.
  Se corrigió el plan para usar `phase-1-seed`, sin afectar el contenido final
  ni el logo.
- Una instalación de dependencias tardó sin mostrar salida y fue detenida de
  forma segura. Posteriormente se comprobó que los archivos de dependencias y
  configuración sí están presentes; todavía falta validarlos con las pruebas.

#### Estado al detenerse

- No hay procesos de Node.js, pnpm o Corepack activos.
- La Fase 1 sigue en estado **Pendiente**: no se ejecutaron con resultado
  registrado lint, typecheck, pruebas unitarias, build ni pruebas E2E.
- No se inició un servidor local, no se publicó nada en GitHub y no se desplegó
  nada en Vercel.
- No se implementaron autenticación, base de datos, movimientos, OCR,
  recordatorios, notificaciones ni grupos. Esas funcionalidades pertenecen a
  fases posteriores.

#### Pendiente para retomar

1. Terminar y validar la Tarea 1: comprobar scripts, ejecutar la prueba inicial
   y crear el primer commit.
2. Ejecutar la Tarea 2: shell responsive público y tokens de diseño.
3. Ejecutar la Tarea 3: manifest, iconos derivados del logo, service worker y
   pruebas de PWA en escritorio/iPhone emulado.
4. Ejecutar la Tarea 4: endpoint de salud, CI de GitHub, configuración Vercel
   y guía de despliegue.
5. Ejecutar la Tarea 5: todas las verificaciones de calidad, cierre documentado
   de Fase 1 y commit final.
6. Solo después de la Fase 1: planificar e implementar Fase 2 (identidad y
   seguridad).
