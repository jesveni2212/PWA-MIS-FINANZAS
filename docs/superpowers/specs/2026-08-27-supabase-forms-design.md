# Conexión de formularios con Supabase

## Objetivo

Conectar los formularios de la aplicación en el orden que establece sus dependencias: Grupos, Movimientos y Perfil. Cada operación debe respetar el usuario autenticado y las políticas de Row Level Security (RLS) de Supabase.

## Alcance

La primera entrega implementará la creación de grupos. Al crear un grupo, el usuario autenticado quedará registrado como su propietario y miembro. La interfaz mostrará estados de carga y errores accionables.

El trabajo posterior conectará los movimientos al grupo elegido y, finalmente, el formulario de perfil a los datos editables del usuario.

## Arquitectura y flujo de datos

El formulario de Grupos será un componente de cliente que usa el cliente de Supabase ya configurado en `src/lib/supabase/client.ts`.

1. Al enviar el formulario, se obtiene el usuario autenticado desde Supabase Auth.
2. Se crea el registro del grupo con el identificador del propietario.
3. Se crea la membresía correspondiente con el rol `owner`.
4. Si cualquiera de las operaciones falla, el formulario conserva sus valores y muestra un mensaje claro; no navega ni afirma que la creación fue exitosa.
5. Tras completar ambas operaciones, la interfaz actualiza o vuelve a consultar la lista de grupos para reflejar el nuevo registro.

Cuando la base de datos soporte una operación atómica mediante función RPC o trigger, se preferirá esa alternativa para impedir que un grupo quede creado sin membresía. Si el esquema actual ya resuelve la membresía automáticamente, el cliente no duplicará esa inserción.

## Autorización

Las tablas usan RLS. Un usuario puede crear y administrar únicamente los grupos donde es miembro, y solo puede crear movimientos en grupos de los que forma parte. El cliente no usa claves de servicio ni intenta eludir políticas de seguridad.

## Próximas conexiones

### Movimientos

El formulario incluirá el grupo como dato obligatorio y guardará el movimiento con `group_id`, importe, tipo, fecha, categoría y nota. Solo se expondrán grupos del usuario autenticado.

### Perfil

El perfil leerá la identidad desde Auth y persistirá únicamente campos de perfil editables en la tabla vinculada por `user_id`. Correo y contraseña continúan bajo gestión de Supabase Auth.

## Manejo de errores y pruebas

- Validar campos requeridos antes de llamar a Supabase.
- Mostrar el error de autenticación cuando no haya sesión.
- Mostrar el error devuelto por Supabase sin filtrar detalles sensibles.
- Deshabilitar el envío mientras la solicitud está en curso.
- Verificar creación correcta, rechazo sin sesión, rechazo para usuarios ajenos y recuperación visual tras un error.

## Fuera de alcance

No se cambian las políticas RLS ni el modelo de datos salvo que la inspección de la migración revele que falta una dependencia imprescindible. No se conectan todavía los formularios de Movimientos ni Perfil.
