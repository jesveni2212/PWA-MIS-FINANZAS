# PWA híbrida de rendimiento y sincronización

**Estado:** diseño aprobado por el usuario el 2026-09-09.

## Objetivo

Hacer que Mis Finanzas se sienta como una aplicación nativa: mostrar la estructura y los datos iniciales sin una espera artificial, abrir rápidamente con la última información disponible, permitir registrar movimientos personales sin conexión y sincronizarlos de forma segura al recuperar internet.

## Alcance

- La primera carga de las pantallas personales usará datos iniciales obtenidos desde el servidor.
- El cliente tendrá una caché por usuario en `IndexedDB` para cuentas y movimientos personales recientes.
- Las lecturas usarán primero la caché y luego revalidarán contra Supabase en segundo plano.
- Sin conexión se podrán consultar las cuentas guardadas y registrar movimientos personales.
- Las altas de cuentas requerirán conexión.
- Los movimientos pendientes se sincronizarán en orden y tendrán un identificador idempotente.
- Grupos, invitaciones y perfil permanecerán online-first en esta etapa.
- El Service Worker almacenará recursos estáticos, nunca HTML personalizado ni respuestas privadas de Supabase.

## Arquitectura

### Carga inicial desde servidor

Las rutas protegidas que muestran información personal recibirán un snapshot inicial desde un loader de servidor autenticado. El snapshot contendrá las cuentas y los movimientos recientes que la pantalla necesita. Los componentes de formulario seguirán siendo componentes cliente, pero no serán responsables de iniciar la primera lectura de la página.

El shell compartido recibirá desde el servidor el nombre de usuario cuando esté disponible. De ese modo se evitará la consulta separada de usuario y perfil al montar el shell en el navegador.

### Repositorio cliente

Se creará un repositorio pequeño con una interfaz única para:

- leer el snapshot inicial;
- leer y escribir la caché local;
- revalidar el ledger online;
- guardar un movimiento online;
- encolar un movimiento cuando no haya conexión;
- sincronizar la cola y publicar el estado de cada operación.

Las pantallas consumirán el estado a través de un proveedor/contexto compartido que permanezca montado durante la navegación. La navegación no volverá a descargar el mismo ledger desde cero en cada pantalla.

### Consultas a Supabase

El ledger personal se expondrá mediante una operación agrupada que devuelva cuentas, movimientos e ítems de compra en una respuesta. La operación respetará `auth.uid()` y las políticas de seguridad existentes. La lista inicial de movimientos tendrá un límite razonable; la pantalla de movimientos podrá solicitar más registros cuando sea necesario.

La función de escritura de movimientos aceptará un `client_operation_id` opcional y tendrá una restricción única por usuario. Si una petición termina con timeout pero el servidor sí guardó el movimiento, un reintento devolverá el mismo identificador en lugar de crear un duplicado.

### Caché y cola

La base local se separará por `userId` y tendrá versión de esquema. Guardará solamente:

- cuentas personales conocidas;
- movimientos recientes e ítems asociados;
- operaciones pendientes con su payload validado, fecha de creación, intentos y último error.

No guardará contraseñas, claves privadas ni tokens de Supabase. Al cerrar sesión, se eliminarán los datos del usuario activo. Una cola pendiente de otro usuario nunca podrá ser procesada con la sesión actual.

El sincronizador se activará al abrir la aplicación, recuperar el evento `online`, volver a una pestaña visible y finalizar una operación online. Usará reintentos con espera creciente para fallos de red. Los errores de validación o autorización quedarán como `Revisar` y no se repetirán indefinidamente.

### Service Worker

Se reemplazará la estrategia actual que guarda `/`, porque esa ruta puede contener HTML personalizado de una sesión. El Service Worker solo podrá aplicar caché de larga duración a recursos estáticos versionados (`/_next/static`, íconos, manifest y recursos de marca). Las navegaciones y las solicitudes de Supabase seguirán siendo de red; el dato financiero offline provendrá de `IndexedDB`, no de la caché HTTP.

## Experiencia de usuario

- La pantalla mostrará contenido real o un skeleton de dimensiones estables, no una espera artificial.
- El shell mostrará `Actualizado ahora`, `Actualizado hace…`, `Sin conexión`, `Sincronizando…` o la cantidad de movimientos pendientes.
- Un movimiento offline aparecerá inmediatamente con estado `Pendiente`.
- El saldo local podrá mostrarse como provisional mientras existan operaciones pendientes; al revalidar, el servidor reemplazará el snapshot.
- Si no existe caché y no hay conexión, se mostrará un estado vacío explicando que hace falta conectarse por primera vez.

## Seguridad y consistencia

- Supabase seguirá siendo la fuente definitiva de saldos y permisos.
- Las operaciones de sincronización se autorizarán nuevamente en el servidor; la caché no concede permisos.
- Los movimientos se tratarán como operaciones anexables, no como ediciones silenciosas de saldos.
- Un reintento no podrá duplicar un movimiento gracias al identificador idempotente.
- Nunca se usará la caché de un usuario para renderizar a otro.

## Validación

- Unit tests para serialización, expiración/versionado de caché, cola, reintentos e idempotencia.
- Pruebas SQL para aislamiento por usuario y para impedir duplicados con el mismo `client_operation_id`.
- E2E en desktop, iPhone y Android para cargar con caché, trabajar offline, reconectar y verificar una sola sincronización.
- Validación de `test`, `typecheck`, `lint`, `build` y rutas de producción.
- Medición antes y después de TTFB, tiempo hasta contenido útil, navegación entre rutas y tamaño de JavaScript en móvil.
