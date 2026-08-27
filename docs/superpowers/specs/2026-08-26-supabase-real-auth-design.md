# Autenticación real con Supabase — diseño

## Objetivo

Activar registro, acceso, recuperación y cierre de sesión reales para Mis
Finanzas mediante Supabase Auth. El primer lanzamiento admite correo y
contraseña; la arquitectura deja Google y Apple listos para activar cuando sus
credenciales OAuth estén disponibles.

## Alcance

- Registro por correo y contraseña con confirmación de email.
- Inicio, recuperación de contraseña, actualización de contraseña y cierre de
  sesión.
- Sesiones SSR en cookies mediante `@supabase/ssr` y flujo PKCE.
- Aplicación de la migración de perfiles, espacios personales y RLS ya
  versionada.
- Páginas y operaciones privadas protegidas mediante una comprobación de
  usuario validada en servidor.
- Botones Google y Apple sólo visibles cuando sus proveedores estén realmente
  habilitados; no se incluyen secretos OAuth en el repositorio.

No forma parte de este trabajo: conexión bancaria, Auth0, Prisma, finanzas
personales, grupos compartidos o administración de usuarios.

## Arquitectura

`src/lib/supabase` contendrá clientes con una única responsabilidad:

- El cliente de navegador inicia registro, acceso, recuperación, cierre y
  OAuth cuando corresponda.
- El cliente de servidor crea un cliente ligado a las cookies de la petición.
- El proxy actual refresca cookies de sesión y realiza sólo una redirección
  optimista. No concede autorización.

Las páginas privadas y cada futura mutación consultarán el usuario autenticado
en el servidor. Las políticas RLS son la segunda barrera, como una caja fuerte
que sigue cerrada aunque una pantalla tuviera un error.

## Flujos

1. Registro: el formulario valida la entrada y solicita `signUp`. Supabase
   envía la confirmación; el trigger crea el perfil, espacio personal y
   membresía de propietario tras crear el usuario.
2. Confirmación: el enlace vuelve a una ruta interna de callback, intercambia
   el código PKCE por cookies de sesión y redirige sólo a un destino interno
   validado.
3. Acceso: `signInWithPassword` crea/actualiza la sesión. El retorno usa
   `safeReturnPath` y nunca acepta URLs externas ni pantallas de autenticación.
4. Recuperación: Supabase envía un enlace; la página de actualización permite
   establecer una nueva contraseña únicamente dentro de la sesión de
   recuperación.
5. Cierre: se invalida la sesión y se redirige a acceso sin conservar datos de
   autenticación en la interfaz.
6. Social: Google y Apple usarán `signInWithOAuth` con callback interno sólo
   después de configurar los proveedores en Supabase. Apple requerirá el
   mantenimiento periódico de su secreto.

## Seguridad y configuración

- `.env.local` conserva URL, clave publicable y URL local; está ignorado por
  Git. Las mismas variables se cargan como secretos del entorno de despliegue.
- La clave `service_role`, contraseñas, secretos OAuth y cadenas directas de
  PostgreSQL no se envían al navegador ni se registran en logs.
- Se habilita confirmación de email y políticas de contraseña en Supabase.
- Los errores de autenticación son genéricos para evitar revelar si una cuenta
  existe.
- La migración se ejecuta desde el SQL Editor o CLI autenticada de Supabase,
  no desde la aplicación web.
- RLS permanece activa para toda tabla financiera; el backend no usa una clave
  privilegiada para solicitudes realizadas en nombre de una persona.

## Pruebas y evidencia

- Unitarias: clientes/configuración, destinos de retorno y estados de los
  formularios.
- E2E: registro, acceso, cierre, recuperación y bloqueo de rutas privadas.
- SQL: creación de perfil/espacio/membresía y aislamiento entre dos usuarios.
- Calidad: lint, tipado, pruebas, build y E2E.
- Prueba manual: confirmar email y restablecer contraseña con el proyecto
  Supabase configurado; documentar las credenciales como configuradas sin
  revelar sus valores.

## Criterios de aceptación

- Una persona puede registrarse, confirmar su correo, iniciar/cerrar sesión y
  recuperar su contraseña.
- Ninguna ruta privada expone datos a un usuario anónimo o ajeno.
- Las credenciales y secretos no aparecen en Git, pruebas, interfaz ni logs.
- Google y Apple permanecen invisibles e inactivos hasta configurarse de
  verdad, y pueden habilitarse sin modificar el modelo de datos ni RLS.
