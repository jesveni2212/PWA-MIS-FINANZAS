# Diseño: estabilización de calidad local

## Objetivo

Establecer una línea base reproducible para los cambios locales mediante lint,
verificación de tipos, pruebas unitarias y compilación de producción, sin
modificar código de aplicación, configuración ni el proyecto remoto de
Supabase.

## Alcance

Se ejecutarán los scripts existentes `lint`, `typecheck`, `test` y `build` en
ese orden. Se conservará el resultado de cada uno y se clasificarán los
diagnósticos por configuración, autenticación, perfil, cuentas, movimientos o
grupos.

Los cambios en `next-env.d.ts`, `.next` y `tsconfig.tsbuildinfo` se tratarán
como artefactos generados: se observarán, pero no se editarán ni se tomarán
como una corrección.

## Flujo y manejo de fallos

Cada comando se ejecuta de forma independiente, de modo que un fallo no impide
capturar el estado de los demás controles. Si todos finalizan correctamente,
la fase concluye con una línea base aprobada. Si un fallo exige cambiar código
o configuración, no se corrige en esta fase: se crea una especificación
focalizada para un único módulo, con comportamiento observable y una prueba de
regresión, antes de planificar e implementar la corrección.

## Criterios de aceptación

- Se registran los códigos de salida y diagnósticos de los cuatro controles.
- No se añaden dependencias ni se desactivan verificaciones para ocultar
  errores.
- No se realizan operaciones remotas de Supabase.
- Cualquier posible corrección funcional queda delimitada en una especificación
  independiente antes de editar código.

## Revisión propia

El alcance contiene un único objetivo, define el orden de validación, separa
artefactos generados de cambios funcionales y no deja decisiones pendientes.
