# Despliegue remoto seguro de cuatro migraciones — Diseño

## Objetivo

Inspeccionar y, tras aprobación explícita, aplicar de forma segura las cuatro
migraciones locales al proyecto Supabase enlazado, sin alterar datos ni
historial remoto durante la fase de previsualización.

## Alcance

El conjunto ordenado es:

1. `20260821_identity_security.sql`
2. `20260827090000_shared_groups.sql`
3. `20260827100000_movements.sql`
4. `20260828090000_accounts.sql`

La fase cubre el historial de migraciones, la previsualización, el despliegue
solo si la persona usuaria lo aprueba después de la previsualización, y la
confirmación posterior. La prueba local de autorización con pgTAP se realizará
solo si Docker está disponible.

## Flujo y límites de seguridad

1. Confirmar que el CLI está enlazado al proyecto ya configurado, sin imprimir
   credenciales ni valores de entorno.
2. Ejecutar `supabase migration list --linked` para comparar el historial
   local y remoto.
3. Detenerse si hay una diferencia que no sea exactamente el conjunto de
   migraciones pendientes esperado.
4. Ejecutar `supabase db push --linked --dry-run` y revisar que lista las
   cuatro migraciones en orden cronológico.
5. Solicitar autorización explícita antes de `supabase db push --linked`.
6. Tras un despliegue exitoso, volver a ejecutar `migration list --linked` y
   confirmar que local y remoto coinciden.

No se usarán `migration repair`, `db pull`, `db reset`, `--include-all` ni
`--include-seed`. No se crearán datos de semilla ni se registrarán secretos.

## Arquitectura

Supabase CLI es el ejecutor de migraciones y
`supabase_migrations.schema_migrations` es la fuente de verdad del historial
remoto. Los archivos SQL versionados son la fuente de verdad local. La
previsualización es el puente entre ambas fuentes: permite verificar el cambio
sin escribir en la base de datos.

Las cuatro migraciones se aplican de forma secuencial, por su versión en el
nombre de archivo. La aplicación web no interviene en el despliegue y no se
modifica código de interfaz durante esta fase.

## Criterios de aceptación

- El historial remoto se puede leer y no contiene discrepancias inesperadas.
- El dry-run enumera solo las cuatro migraciones indicadas, en ese orden.
- Un `db push` solo se ejecuta con autorización posterior a ese resultado.
- El historial posterior refleja las cuatro migraciones locales.
- Si Docker está disponible, las pruebas `shared_groups_security.sql` y
  `movements_security.sql` terminan correctamente contra Supabase local.

## Riesgos y tratamiento

El CLI puede requerir una sesión interactiva o quedar bloqueado por red. En ese
caso se detiene el proceso sin escritura y se informa el bloqueo. Si el
historial remoto no coincide, no se intenta repararlo automáticamente.

La migración de cuentas amplía el conjunto previamente revisado de tres a
cuatro. Por ello no se reutiliza una previsualización anterior: esta fase exige
una nueva previsualización que incluya la cuarta migración.

## Revisión propia

- El alcance enumera versiones y archivos inequívocos.
- La escritura remota depende de una aprobación posterior al dry-run.
- Los comandos excluidos cubren las alternativas destructivas o de reparación
  de historial.
