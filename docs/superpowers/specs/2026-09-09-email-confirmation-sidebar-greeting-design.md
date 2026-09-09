# Diseno - confirmacion de correo y saludo compacto autenticado

**Fecha:** 2026-09-09  
**Estado:** pendiente de revision del usuario antes de planificar

## 1. Contexto

El registro actual crea la cuenta con correo y contrasena. Cuando Supabase exige
confirmar el correo, el enlace llega al callback de autenticacion, pero el
callback termina enviando al usuario a `/`. Como esa ruta es privada, un usuario
que todavia no tiene una sesion utilizable termina viendo la pantalla de inicio
de sesion.

La aplicacion ya tiene un perfil `public.profiles` con `display_name` opcional.
El panel autenticado usa `AppShell`, cuyo menu lateral contiene la navegacion y
el control para ocultar saldos.

## 2. Objetivo y limites

El objetivo es separar claramente las dos experiencias:

1. despues de validar el enlace, mostrar una pantalla centrada de confirmacion;
2. despues de iniciar sesion, mostrar un saludo compacto en el panel lateral.

Quedan fuera de alcance:

- pedir nombre de usuario durante el registro;
- mostrar un saludo en la pantalla de validacion del correo;
- cambiar el modelo de autenticacion, claves, migraciones o politicas RLS;
- exponer el correo del usuario como fallback visual;
- alterar el contenido de los menus o la logica de ocultar saldos.

## 3. Experiencia propuesta

### 3.1 Registro y enlace de confirmacion

Al enviar el formulario de registro, `signUp` recibira un `emailRedirectTo`
apuntando al origen actual y a `/auth/callback?next=/registro-confirmado`.
Esto permite que los entornos locales, preview y produccion usen su propio
origen, siempre que ese origen este habilitado en Supabase.

Si Supabase devuelve una sesion inmediata porque la confirmacion por correo esta
desactivada, el formulario navegara igualmente a `/registro-confirmado` para
mantener una experiencia coherente. Si no devuelve sesion, mantendra el mensaje
actual indicando que revise su correo.

### 3.2 Pantalla de confirmacion

Se agregara la ruta publica `/registro-confirmado`, con una tarjeta centrada y
responsiva, siguiendo la opcion B del mockup visual:

- icono de exito;
- titulo `Correo confirmado`;
- texto `Tu registro se completo correctamente. Tu cuenta ya esta lista.`;
- boton principal `Entrar a Mis Finanzas` que lleva a `/`.

Esta pantalla no mostrara nombre ni saludo. El callback redirigira alli despues
de un intercambio PKCE exitoso. Si el codigo falta, expiro o no puede
intercambiarse, se mostrara un estado de problema dentro de la misma tarjeta,
con una accion para volver a iniciar sesion, sin revelar el detalle interno del
error.

Los demas usos del callback, como recuperacion de contrasena, conservaran su
destino actual. Los destinos externos o rutas de autenticacion seguiran siendo
rechazados por `safeReturnPath`.

### 3.3 Saludo en el panel autenticado

`AppShell` incorporara un saludo compacto al pie del panel lateral de escritorio,
antes del control `Ocultar saldos`, sin desplazar ni renombrar los enlaces del
menu. El texto sera:

- `Hola, <nombre>` cuando `profiles.display_name` exista y no este vacio;
- `Bienvenido/a` cuando el perfil no tenga nombre o la consulta no este
  disponible.

No se usara la parte local del correo como fallback. En pantallas pequenas, el
saludo se mostrara en la cabecera superior, porque el menu lateral se convierte
en navegacion inferior.

## 4. Diseno tecnico

### Callback y rutas

- Mantener `/auth/callback` como punto unico de intercambio PKCE.
- Hacer que el callback revise el resultado de `exchangeCodeForSession` en vez
  de ignorar un objeto `error` devuelto por Supabase.
- Cuando `next` sea `/registro-confirmado`, redirigir al estado exitoso despues
  de un intercambio correcto y al estado de error si el intercambio falla o no
  hay codigo.
- Mantener el comportamiento existente para recuperacion de contrasena y
  otros destinos internos seguros.

### Datos del saludo

Se agregara un componente cliente pequeno para cargar el usuario autenticado y
su `display_name` desde `public.profiles`. La consulta usara el cliente publico
existente y la politica RLS ya definida para el propio perfil. El fallo de esta
consulta no bloqueara el panel: se conservara el fallback `Bienvenido/a`.

El componente escapara el nombre mediante el render normal de React y no
mostrara valores provenientes de la URL.

## 5. Verificacion

- Probar que el registro envia `emailRedirectTo` con el callback y el destino de
  confirmacion.
- Probar que el callback redirige al estado exitoso de confirmacion solo cuando
  el intercambio PKCE termina sin error.
- Probar estados sin codigo, codigo invalido y destino externo.
- Probar visualmente la tarjeta de confirmacion en escritorio y movil.
- Probar que el saludo usa `display_name` y que usa `Bienvenido/a` para nombre
  vacio o error de consulta.
- Ejecutar `corepack pnpm test --pool=forks --maxWorkers=1`.
- Ejecutar `corepack pnpm typecheck`, `corepack pnpm lint` y
  `corepack pnpm build`.
- Verificar manualmente el flujo completo con un correo de prueba de Supabase.

## 6. Criterios de aceptacion

1. Al pulsar el enlace de confirmacion, el usuario ve una pantalla de exito
   centrada y no es enviado directamente al login.
2. La pantalla de confirmacion no muestra saludo ni nombre.
3. El boton de la pantalla permite entrar a la aplicacion cuando existe una
   sesion confirmada.
4. El panel autenticado muestra el saludo compacto en la zona lateral elegida.
5. Un perfil con nombre muestra `Hola, <nombre>`; un perfil sin nombre muestra
   `Bienvenido/a` sin exponer el correo.
6. Un error de validacion se comunica dentro de una pantalla controlada y no
   rompe los flujos de recuperacion de contrasena.
7. Las pruebas, el lint, el typecheck y el build pasan sin cambios a secretos o
   politicas de Supabase.
