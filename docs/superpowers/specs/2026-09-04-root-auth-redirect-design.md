# Redirección de la ruta raíz según sesión

## Objetivo

Al acceder a `/`, una persona sin una sesión válida debe ser enviada a `/acceso`. Una persona autenticada debe ver el panel financiero actual en `/`.

## Diseño

La página servidor de `src/app/page.tsx` consultará el usuario autenticado mediante el cliente de Supabase para servidor. Si `auth.getUser()` no devuelve usuario, ejecutará `redirect("/acceso")`; si devuelve usuario, renderizará el `AppShell` con `PersonalDashboard` sin cambios visuales.

El `proxy` existente seguirá siendo la barrera temprana para `/`, `/movimientos`, `/grupos` y `/perfil`. La comprobación en la página raíz funciona como defensa adicional y evita que el panel se renderice cuando la ejecución del proxy no haya impedido el acceso. No se cambiará el destino de usuarios autenticados ni se alterará el flujo de callback.

## Manejo de errores

Si Supabase no puede validar la sesión, la ausencia de usuario se tratará como no autenticado y la persona será enviada a `/acceso`. No se mostrará el panel por una comprobación optimista del cliente.

## Pruebas y aceptación

- La página raíz redirige a `/acceso` cuando `getUser()` no devuelve usuario.
- La página raíz renderiza el panel cuando existe usuario.
- Las pruebas existentes de rutas privadas y autenticación continúan pasando.
- El chequeo de tipos, lint y suite de tests deben finalizar correctamente.
