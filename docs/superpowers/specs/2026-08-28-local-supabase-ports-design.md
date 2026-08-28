# Puertos locales de Supabase — diseño

## Objetivo

Permitir que la pila local de Supabase se inicie en Docker Desktop/WSL sin
usar los puertos reservados por Windows.

## Decisión

`supabase/config.toml` sustituirá el bloque local `54320–54329` por
`55020–55029`. Se mantienen los mismos servicios y la configuración remota no
se modifica.

| Servicio | Puerto actual | Puerto nuevo |
| --- | ---: | ---: |
| API | 54321 | 55021 |
| Base de datos | 54322 | 55022 |
| Base de datos sombra | 54320 | 55020 |
| Pooler | 54329 | 55029 |
| Studio | 54323 | 55023 |
| SMTP local | 54324 | 55024 |
| Analítica | 54327 | 55027 |

## Validación

Se iniciará `supabase start` desde Ubuntu/WSL y, si inicia, se ejecutarán las
dos suites pgTAP locales. No se ejecutará ningún comando contra Supabase remoto.
