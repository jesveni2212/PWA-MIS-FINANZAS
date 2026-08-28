# Perfil básico con Supabase — diseño

## Objetivo

Permitir que el usuario autenticado consulte y actualice su nombre visible.

## Alcance

- Mostrar el correo obtenido de Supabase Auth como información de solo lectura.
- Cargar y editar únicamente `profiles.display_name`.
- Guardar con el cliente de navegador y las políticas RLS existentes.
- Mostrar estados accesibles de carga, ausencia de sesión, error y éxito.

## Fuera de alcance

- Cambiar correo, contraseña, avatar, moneda o preferencias.
- Usar claves de servicio o modificar la autenticación y las migraciones.

## Arquitectura

`/perfil` seguirá siendo una ruta protegida y renderizará un componente de
cliente dedicado. El componente obtiene el usuario de Auth, consulta su fila
en `profiles` y guarda el nombre normalizado mediante `update` filtrado por el
identificador del usuario. RLS sigue siendo el límite de autorización.

## Manejo de errores y validación

El nombre es obligatorio después de eliminar espacios alrededor. Mientras se
carga o guarda, el formulario refleja su estado y evita envíos duplicados. Si
no hay sesión o Supabase devuelve un error, no se afirma que se guardó nada.

## Pruebas

Las pruebas unitarias cubrirán carga correcta, perfil ausente, sesión ausente,
validación local, error de consulta y guardado exitoso con el identificador del
usuario autenticado.

## Auto-revisión

- Sin marcadores ni decisiones pendientes.
- El alcance no modifica datos ni flujos fuera de `profiles.display_name`.
- La lectura y escritura usan el mismo identificador de usuario y no exponen
  credenciales privilegiadas.
