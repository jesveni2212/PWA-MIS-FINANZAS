# Diseño: permisos de actualización por columna en perfiles

## Objetivo

Impedir que el rol `authenticated` actualice columnas de `public.profiles`
distintas de `display_name`, incluso si invoca la API directamente.

## Cambio de seguridad

Una nueva migración revocará el privilegio general `UPDATE` sobre
`public.profiles` para `authenticated` y concederá exclusivamente
`UPDATE (display_name)` al mismo rol. La política RLS `profiles_update_own`
se conserva sin cambios para limitar la fila a `auth.uid()`.

## Comportamiento verificable

Un usuario autenticado podrá actualizar su propio nombre visible. Un intento
de actualizar su propio correo será rechazado por falta de privilegio de
columna. El formulario existente no cambia porque ya envía solo
`{ display_name }`.

## Pruebas

Una suite pgTAP creará perfiles de prueba, asumirá el rol `authenticated` y
fijará el sujeto JWT. Debe comprobar una actualización permitida de
`display_name` y una actualización de `email` que falle con el privilegio
insuficiente.

## Límites

No se introducen RPCs, claves de servicio, cambios al formulario, ni se
modifica la política RLS. La migración se desplegará solo después de un
dry-run remoto verificable y autorización explícita.

## Revisión propia

El cambio reduce privilegios sin alterar la interfaz existente, preserva la
frontera de fila de RLS y cuenta con una prueba positiva y una negativa.
