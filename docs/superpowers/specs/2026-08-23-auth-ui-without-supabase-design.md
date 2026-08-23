# Acceso preparado para Supabase — diseño

## Objetivo

Entregar la interfaz y las rutas de acceso de Mis Finanzas sin requerir todavía
un proyecto Supabase configurado. La aplicación debe quedar lista para activar
el registro, inicio de sesión y recuperación cuando se añadan las variables
públicas de Supabase.

## Comportamiento

- La portada mostrará enlaces visibles a `Iniciar sesión` y `Quiero ser cliente`.
- Las páginas `/acceso`, `/registro` y `/recuperar-contrasena` incluirán
  formularios accesibles con correo, contraseña cuando corresponda y enlaces
  entre los tres flujos.
- Una configuración central determinará si existen URL y clave pública de
  Supabase. Si faltan, los formularios no enviarán solicitudes ni simularán
  usuarios: mostrarán un mensaje de configuración pendiente.
- Los controles de Google y Apple no se mostrarán mientras no estén habilitados
  mediante variables públicas.
- Las rutas privadas conservarán un destino interno seguro y redirigirán a
  `/acceso` hasta que una sesión real pueda validarse.

## Límites

No se crean usuarios locales, sesiones ficticias ni tablas nuevas. La conexión
real con Supabase, el callback, la confirmación de correo y el cierre de sesión
se implementarán una vez que la persona responsable proporcione un proyecto y
sus variables de configuración.

## Errores y privacidad

El aviso de configuración no expondrá valores, URLs, claves ni detalles del
entorno. Las validaciones de formulario serán accesibles y locales. Las rutas
de retorno solo aceptarán rutas internas y no podrán apuntar a pantallas de
autenticación ni a otros sitios.

## Verificación

- Pruebas unitarias para la detección de configuración y rutas de retorno.
- Pruebas de componentes para los formularios y el aviso sin Supabase.
- Pruebas de navegación para los enlaces públicos y la redirección de rutas
  privadas.
- Lint, tipado, pruebas y build ejecutados desde la carpeta principal.

## Criterios de aceptación

- Las tres páginas públicas de acceso son navegables y accesibles sin
  credenciales.
- Ningún formulario crea una cuenta ni reporta un inicio de sesión inexistente
  sin Supabase configurado.
- Google y Apple no aparecen como opciones activas sin configuración.
- Los usuarios anónimos no pueden acceder directamente a rutas privadas.
