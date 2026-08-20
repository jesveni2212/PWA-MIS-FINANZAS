# Diseño — shell moderno de la Fase 1

**Fecha:** 2026-08-20  
**Estado:** aprobado para revisión del documento y planificación

## Objetivo

Completar las fundaciones públicas de Mis Finanzas con una primera pantalla
responsive, llamativa y clara. Esta entrega prepara la PWA para su despliegue,
sin introducir autenticación, datos financieros ni persistencia.

## Dirección visual

La interfaz seguirá una estética financiera contemporánea: fondo gris verdoso
muy claro, superficies blancas, texto oscuro y una paleta principal esmeralda y
turquesa. Un acento coral se reservará para llamadas de atención. El bloque
principal empleará un degradado suave y tarjetas de presentación para comunicar
el futuro dashboard sin representar importes ni movimientos reales.

La composición será móvil primero. En teléfonos, la navegación se fija en la
parte inferior; en pantallas mayores se integra al flujo de la página para no
ocultar contenido. La tipografía nativa mantiene una carga rápida y una buena
lectura en iPhone y escritorio.

## Componentes y límites

- `src/lib/site.ts` será la fuente única de nombre, descripción y etiquetas de
  navegación.
- `AppShell` renderizará el encabezado, el área principal y la navegación
  semántica. No contendrá reglas de negocio ni estado de datos.
- La página inicial compondrá el hero y las tarjetas de presentación dentro de
  `AppShell`.
- `PwaRegister` será un componente cliente mínimo dedicado únicamente a
  registrar el service worker si el navegador lo permite.
- El manifest y `public/sw.js` definirán la instalación y una recuperación
  offline segura hacia la ruta inicial.

Este aislamiento funciona como un tablero eléctrico: cada interruptor controla
una sola función, de modo que cambiar el aspecto no afecta la instalación PWA
ni la futura lógica financiera.

## Flujo y resiliencia

El visitante carga la ruta pública, ve el shell y puede instalar la PWA cuando
el navegador la soporte. El registro del worker ocurre tras montar la página;
si el navegador no soporta service workers, la interfaz continúa funcionando.
Las solicitudes `GET` que fallen sin conexión recuperan la pantalla inicial
desde la caché. El endpoint `GET /api/health` responderá con `200` y
`{ status: "ok" }` para comprobaciones de despliegue.

## Activos y accesibilidad

`LOGO.JPG` de la raíz no se modifica. Se crearán iconos PNG cuadrados de 192 y
512 píxeles derivados de él en `public/brand/`. La página usará `header`,
`main` y `nav`, etiquetas accesibles y contraste suficiente. Los elementos
táctiles de la navegación se dimensionarán para móvil.

## Validación

- Pruebas unitarias para el shell, el registro del worker y el endpoint de
  salud.
- Prueba de navegador de la landing y el manifest en Chrome de escritorio e
  iPhone emulado.
- Puerta de calidad: lint, comprobación de tipos, pruebas unitarias, build y
  pruebas E2E.
- CI en GitHub repetirá las comprobaciones locales; Vercel será el destino de
  despliegue preparado, sin publicar ni configurar secretos en esta fase.

## Fuera de alcance

No se implementarán autenticación, base de datos, cuentas, movimientos,
montos reales, OCR, notificaciones ni grupos compartidos. Corresponden a fases
posteriores.
