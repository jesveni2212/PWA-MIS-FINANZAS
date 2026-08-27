# Lista de grupos compartidos

## Objetivo

Completar la pantalla protegida `/grupos` para que cada usuario autenticado pueda ver los grupos compartidos a los que tiene acceso, crear un grupo y ver el nuevo elemento sin recargar la página.

## Alcance

- Consultar únicamente filas `financial_spaces` con `kind = 'shared'` mediante el cliente de Supabase del navegador y las políticas RLS existentes.
- Mostrar estados de carga, lista, lista vacía y error.
- Incluir un botón explícito `Reintentar` cuando la consulta falle.
- Crear grupos exclusivamente mediante la RPC `create_shared_group` y refrescar la lista tras una respuesta exitosa.
- Mantener la página y los mensajes en español.

No se incluyen invitaciones, edición de roles, detalle de grupos ni movimientos compartidos.

## Arquitectura y flujo

`src/app/grupos/page.tsx` seguirá siendo un Server Component protegido y compondrá la estructura visual de la sección junto con `GroupsContent`.

`GroupsContent` será un Client Component responsable de cargar `id`, `name` y `created_at` desde `financial_spaces`, filtrando por `kind = 'shared'` y ordenando por creación descendente. La función de carga se reutilizará tanto al montar el componente como al pulsar `Reintentar` y después de crear un grupo.

`CreateGroupForm` aceptará una prop opcional `onCreated`. Tras una RPC exitosa —con datos y sin error— limpiará el formulario, conservará el mensaje de éxito e invocará esa devolución de llamada. Ante un error no llamará a la devolución de llamada ni borrará el nombre escrito.

## Estados y accesibilidad

- Durante la carga se mostrará un mensaje con `aria-live="polite"`.
- Una lista con resultados se representará como un `ul` etiquetado.
- Sin resultados se indicará que todavía no hay grupos compartidos.
- Ante error se mostrará un mensaje genérico, sin detalles sensibles del proveedor, y un botón `Reintentar` que vuelve a ejecutar la consulta.
- El botón de creación continuará deshabilitado durante la solicitud.

## Seguridad

El navegador no utilizará credenciales de servicio ni inserciones directas en `memberships`. La autorización de lectura y creación permanece en RLS y en la RPC transaccional existente.

## Pruebas y validación

Las pruebas unitarias comprobarán la consulta filtrada, cada estado de la lista, el reintento, la devolución de llamada posterior a una creación exitosa y la integración de la página. La validación final ejecutará lint, comprobación de tipos, el conjunto de pruebas y build.
