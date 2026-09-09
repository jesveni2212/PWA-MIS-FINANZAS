# Recordatorios recurrentes y notificaciones web

**Estado:** diseño aprobado por el usuario el 2026-09-09.

## Objetivo

Permitir que cada usuario programe recordatorios de gastos fijos e ingresos esperados, reciba avisos antes del vencimiento y gestione el permiso de notificaciones del navegador desde su perfil, sin crear movimientos financieros automáticamente.

## Alcance

- Nueva ruta principal `/recordatorios`.
- Acceso desde la navegación lateral y móvil.
- Periodicidades disponibles desde el inicio: mensual, semanal, anual y personalizada.
- La periodicidad mensual será la opción inicial del formulario, no la única.
- Cada vencimiento tendrá estado `pendiente`, `pagado` u `omitido`.
- Marcar un recordatorio como pagado no creará un movimiento automáticamente.
- Se podrán configurar nombre, categoría, importe opcional, moneda, fecha/regla de vencimiento, anticipación y estado activo.
- Las preferencias de notificaciones estarán dentro de `Perfil`.
- El permiso del navegador se solicitará únicamente después de una acción explícita del usuario.
- Si el usuario no concede push, se mantendrán avisos dentro de la aplicación.

## Modelo de datos

Se agregarán tablas protegidas por usuario:

### `financial_reminders`

Almacenará la regla recurrente: propietario, nombre, categoría, importe opcional, moneda opcional, tipo de periodicidad, configuración de la regla, próxima fecha, anticipación del aviso, zona horaria y estado activo.

La configuración tendrá una forma validada según el tipo:

- semanal: día de la semana;
- mensual: día del mes;
- anual: mes y día;
- personalizada: intervalo y unidad permitida.

Una fecha mensual como el día 31 se ajustará al último día disponible del mes.

### `financial_reminder_occurrences`

Representará cada vencimiento concreto, con fecha, estado, fecha de resolución y relación con el recordatorio. Tendrá una restricción única por recordatorio y fecha para evitar ocurrencias duplicadas.

### `push_subscriptions`

Guardará las suscripciones Web Push por usuario y dispositivo: endpoint, claves públicas necesarias para el envío, fecha de actividad y estado. Un usuario podrá tener varios dispositivos.

### `notification_deliveries`

Registrará cada envío por ocurrencia y dispositivo. Una restricción única impedirá enviar dos veces el mismo aviso al mismo dispositivo.

### Preferencias

Se guardará la preferencia de avisos push del usuario. El permiso real del navegador seguirá siendo una decisión local del navegador y se mostrará en la interfaz como `Permitido`, `No permitido` o `Sin configurar`.

## Flujo de recordatorios

1. El usuario crea un recordatorio desde `/recordatorios`.
2. La aplicación genera o actualiza la próxima ocurrencia según la regla.
3. En cada fecha, el usuario puede marcarla como pagada, posponerla u omitirla.
4. Resolver una ocurrencia calcula la siguiente fecha sin generar un movimiento contable.
5. Al abrir la app, los vencimientos próximos y vencidos aparecen dentro de la lista aunque no se haya recibido push.

## Flujo de permisos y push

1. En `Perfil → Preferencias → Notificaciones`, el usuario pulsa `Activar notificaciones`.
2. En respuesta a ese gesto, el navegador muestra su solicitud nativa de permiso.
3. Si se concede, el Service Worker obtiene una suscripción Web Push y la guarda asociada al usuario y dispositivo.
4. Un proceso programado de Supabase revisa las ocurrencias que entran en su ventana de aviso.
5. Antes de enviar, registra una entrega idempotente y luego envía el push usando la clave privada VAPID almacenada como secreto del backend.
6. El aviso mostrará el nombre del recordatorio y la fecha; el importe completo se consultará dentro de la app para no exponerlo innecesariamente en una pantalla bloqueada.
7. Al pulsar la notificación, el Service Worker abrirá `/recordatorios`.
8. Si el usuario desactiva la preferencia, se dejarán de generar envíos para sus dispositivos, pero los avisos internos continuarán disponibles.

El proceso programado se implementará como una Edge Function de Supabase invocada por el scheduler del proyecto. Las claves privadas no llegarán al cliente.

## Experiencia de usuario

- La opción `Recordatorios` será principal en escritorio y móvil.
- En móvil habrá seis opciones distribuidas en dos filas compactas para mantenerlas visibles.
- La lista distinguirá claramente recordatorios próximos, vencidos, pagados y omitidos.
- Cada tarjeta ofrecerá `Marcar como pagado`, `Posponer` y `Omitir`.
- El formulario mostrará solo los campos relevantes para la periodicidad elegida, manteniendo disponibles todas las periodicidades.
- Si el permiso fue rechazado, se explicará que debe cambiarse desde la configuración del navegador.

## Seguridad y fallos

- Las políticas RLS limitarán recordatorios, ocurrencias, preferencias y suscripciones al usuario propietario.
- El backend de notificaciones verificará que la entrega corresponda al usuario y dispositivo correctos.
- Las entregas tendrán idempotencia para tolerar reintentos del scheduler.
- Una suscripción inválida se desactivará después de una respuesta permanente de Web Push.
- La falta de push nunca eliminará el recordatorio ni impedirá verlo dentro de la app.

## Validación

- Unit tests para reglas semanal, mensual, anual y personalizada, incluyendo el día 31.
- Unit tests para estados de ocurrencia y cálculo de la siguiente fecha.
- Pruebas SQL de aislamiento y restricciones anti-duplicado.
- E2E de creación, edición, pausa, pago, posposición y omisión.
- E2E del flujo de permiso con la API de notificaciones simulada.
- Prueba de integración de la Edge Function con entrega idempotente.
- Validación en escritorio, Android y una PWA instalada en iPhone cuando el navegador lo permita.
