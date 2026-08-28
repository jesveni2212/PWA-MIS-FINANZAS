# Conexión de Supabase CLI y validación remota

## Objetivo

Conectar la CLI de Supabase al proyecto existente de Mis Finanzas para aplicar de forma controlada las migraciones locales y comprobar que la base de datos admite los flujos de identidad, grupos compartidos y movimientos.

## Alcance

- Usar la CLI mediante `npx supabase`, sin instalarla globalmente.
- Autenticar al operador por el flujo oficial de inicio de sesión y enlazar el proyecto con su Project Reference.
- Inspeccionar el estado de migraciones remoto antes de cualquier escritura.
- Aplicar, en orden, las migraciones de identidad/seguridad, grupos compartidos y movimientos.
- Ejecutar las pruebas SQL de seguridad cuando el entorno remoto tenga la extensión y la configuración necesarias.
- Ejecutar la compuerta local: lint, tipado, pruebas, build y E2E.

## Fuera de alcance

- No se guardan tokens de acceso, contraseñas de base de datos ni claves `service_role` en archivos del proyecto.
- No se habilitan todavía Google ni Apple, ni se modifica la interfaz de autenticación.
- No se crean usuarios de producción ni se alteran manualmente las tablas fuera de las migraciones versionadas.

## Flujo

1. Confirmar que `.env.local` contiene URL y Publishable key sin mostrar sus valores.
2. Iniciar sesión con la CLI y enlazar usando el Project Reference aportado por el usuario.
3. Comparar el historial remoto con `supabase/migrations/`.
4. Aplicar las migraciones en orden cronológico y volver a comprobar el historial.
5. Ejecutar las pruebas de seguridad de grupos y movimientos, o documentar el requisito faltante si el proyecto remoto no dispone de pgTAP.
6. Ejecutar la compuerta de calidad local y revisar el árbol de trabajo antes de confirmar cambios intencionales.

## Seguridad y recuperación

La CLI obtiene autorización en sesión del operador y no persiste secretos dentro del repositorio. Antes de aplicar migraciones se inspecciona el historial; si no coincide con el esperado, se detiene el proceso y se informa la discrepancia. Las migraciones no se editarán después de haberse aplicado: cualquier ajuste posterior será una migración nueva.

## Criterios de éxito

- El proyecto remoto queda enlazado sin secretos añadidos al repositorio.
- Las tres migraciones locales se registran como aplicadas o se documenta con precisión el bloqueo.
- Los flujos de creación y lectura quedan protegidos por las políticas RLS versionadas.
- La compuerta local finaliza sin errores, salvo límites externos documentados.

## Revisión propia

- No hay marcadores pendientes ni pasos ambiguos.
- El alcance excluye explícitamente proveedores OAuth y datos de producción.
- La inspección precede a toda operación remota de escritura.
