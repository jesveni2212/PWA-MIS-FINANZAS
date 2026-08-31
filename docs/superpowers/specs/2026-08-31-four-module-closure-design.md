# Diseño: cierre integrado de perfil, grupos, cuentas y movimientos

## Objetivo

Completar y verificar los cuatro módulos funcionales de Mis Finanzas sobre el
esquema Supabase ya desplegado, preservando la autorización por usuario y por
espacio financiero.

## Alcance y secuencia

La entrega se divide en verticales revisables para evitar que una corrección
en un módulo oculte regresiones en los demás:

1. Auditar las implementaciones locales existentes de perfil, grupos, cuentas
   y movimientos contra sus consultas, políticas RLS y estados de interfaz.
2. Cerrar perfil y grupos como módulos independientes: perfil solo actualiza
   `profiles.display_name`; grupos lista espacios compartidos visibles y crea
   grupos únicamente mediante `create_shared_group`.
3. Cerrar cuentas dentro del espacio personal del usuario autenticado.
4. Cerrar movimientos después de cuentas, validando pertenencia al espacio y
   los campos de movimiento antes de persistirlos.
5. Ejecutar pruebas focalizadas por módulo y una comprobación integrada de
   calidad antes del cierre.

## Límites de autorización

El cliente usa exclusivamente la clave pública de Supabase y las políticas
RLS existentes son la frontera de autorización. No se usan credenciales de
servicio, no se hacen inserciones directas de membresías, y las operaciones
compartidas se limitan a los espacios que el usuario puede leer o en los que
es miembro.

## Manejo de estados

Cada módulo debe representar carga, vacío, éxito y error de forma clara y en
español. Las mutaciones validan la entrada antes de invocar Supabase, mantienen
los datos si la operación falla y actualizan la vista solo después de una
respuesta exitosa.

## Pruebas y cierre

Cada vertical conserva pruebas unitarias de sus estados principales y de sus
llamadas protegidas. Los cambios se validan con lint, tipos, pruebas y build;
cualquier diferencia de permisos se prueba de manera aislada antes de ampliar
el siguiente módulo.

## Revisión propia

El diseño separa los módulos por responsabilidad, establece que movimientos
depende de cuentas, conserva RLS como frontera de seguridad y evita cambios
remotos o credenciales privilegiadas. No contiene comportamientos pendientes
sin dueño ni combina dos módulos en una misma corrección.
