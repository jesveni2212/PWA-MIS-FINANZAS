# Guía de ingeniería — Mis Finanzas

## Propósito

Construir una PWA de finanzas personales y compartidas que sea segura, rápida,
usable en iPhone y computadoras, y capaz de crecer sin reescrituras
innecesarias.

## Principios no negociables

- **SOLID:** cada módulo tiene una responsabilidad clara y depende de
  abstracciones, no de detalles de infraestructura.
- **DRY:** las reglas de negocio, validaciones y tipos se definen una vez y se
  reutilizan.
- **KISS:** elegir la solución más simple que cubra el requisito actual; no
  introducir microservicios ni abstracciones prematuras.
- **Seguridad por defecto:** autenticación obligatoria, autorización por
  servidor, mínimo privilegio, secretos fuera del repositorio y validación de
  toda entrada.
- **Privacidad por defecto:** cada dato financiero queda aislado por espacio y
  membresía; las imágenes de facturas usadas para OCR no se conservan.
- **Accesibilidad y diseño responsive:** móvil primero, navegación utilizable
  con teclado, contraste suficiente, etiquetas semánticas y objetivos táctiles
  amplios.

## Arquitectura acordada

- TypeScript de punta a punta.
- Next.js/React como PWA desplegada en Vercel.
- PostgreSQL administrado y Auth.js para correo/contraseña, Google y Apple.
- Web Push, cron y proveedor de correo desacoplados mediante interfaces.
- Monolito modular: `auth`, `spaces`, `accounts`, `transactions`,
  `recurrences`, `debts`, `groups`, `settlements`, `search`, `ocr` y
  `notifications` no deben mezclar responsabilidades.

## Reglas de implementación

1. Antes de modificar una funcionalidad, identificar su módulo, contrato y
   pruebas afectadas.
2. Mantener componentes de interfaz pequeños; extraer lógica a hooks, casos de
   uso o servicios cuando tenga valor propio.
3. Representar dinero como enteros en unidades menores o una representación
   decimal exacta: nunca usar `float` para cálculos financieros.
4. Toda operación debe conservar su moneda (`PYG` o `USD`) y no convertir sin
   una cotización, fecha y consentimiento explícitos.
5. Toda consulta y mutación debe comprobar en el servidor que el usuario es
   miembro del espacio financiero correspondiente.
6. Las liquidaciones son registros inmutables: corrigen saldos, no destruyen el
   historial del gasto original.
7. Para OCR, procesar archivos temporales, limitar tamaño/tipo, pedir
   confirmación humana y eliminar el archivo después de extraer sugerencias.
8. No registrar secretos, tokens, importes sensibles ni datos personales en
   logs.
9. No añadir dependencias sin justificar su necesidad, mantenimiento, licencia
   y costo operativo.

## Calidad y pruebas

- Probar reglas de negocio con pruebas unitarias: reparto de gastos, balances,
  recurrencias, monedas y permisos.
- Probar flujos críticos de extremo a extremo: registro, inicio de sesión,
  creación de gasto, liquidación, búsqueda, recordatorios y prohibición de
  acceso ajeno.
- Añadir pruebas de regresión ante cada error corregido.
- Ejecutar lint, tipado, pruebas y build antes de marcar una tarea como lista.
- Verificar manualmente los flujos PWA y notificaciones en iPhone y navegador
  de escritorio antes de publicar.

## Comunicación

- Explicar cada bloque de código relevante con una analogía breve y precisa.
  Ejemplo: una capa de autorización es el portero que revisa la lista antes de
  abrir la puerta de un grupo.
- Informar decisiones, cambios, pruebas ejecutadas y riesgos. No presentar una
  funcionalidad como terminada si no fue verificada.
- Después de completar cada fase, actualizar `docs/implementation-phases.md`.
