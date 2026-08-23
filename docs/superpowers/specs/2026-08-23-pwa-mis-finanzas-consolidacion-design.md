# Consolidación de PWA MIS FINANZAS — diseño

## Objetivo

Consolidar `PWA MIS FINANZAS - fase 2` dentro de `PWA MIS FINANZAS` para que el proyecto se mantenga y ejecute desde una única carpeta principal.

## Alcance

- Comparar los elementos de ambas carpetas antes de modificar archivos con nombres coincidentes.
- Integrar en `PWA MIS FINANZAS` los cambios de fase 2 que correspondan a la misma aplicación.
- Mantener una única configuración ejecutable y sus dependencias asociadas desde la carpeta principal.
- Eliminar la carpeta externa `PWA MIS FINANZAS - fase 2` cuando todos sus elementos se hayan integrado.

No se creará ni conservará una copia de respaldo, por decisión explícita de la usuaria.

## Estrategia de integración

1. Inventariar los archivos y configuraciones de ambas carpetas.
2. Para archivos exclusivos de fase 2, moverlos a la ubicación equivalente dentro de la carpeta principal.
3. Para archivos coincidentes, comparar su contenido e integrar los cambios de fase 2 sin descartar modificaciones existentes en el proyecto principal.
4. Unificar referencias de configuración, dependencias y scripts para que apunten a la carpeta principal.
5. Ejecutar las comprobaciones disponibles del proyecto desde `PWA MIS FINANZAS`.
6. Eliminar la carpeta externa tras confirmar que no contiene archivos pendientes.

## Manejo de conflictos y errores

La integración se detendrá ante un conflicto que no pueda resolverse comparando el código o la configuración. No se sobrescribirá un archivo coincidente a ciegas. Si alguna verificación falla, se corregirá la configuración consolidada antes de eliminar la carpeta externa.

## Criterios de aceptación

- Todo el código y los recursos de fase 2 que formen parte de la aplicación están dentro de `PWA MIS FINANZAS`.
- La aplicación se puede instalar, compilar o ejecutar desde la carpeta principal mediante sus comandos habituales.
- No queda una carpeta de proyecto independiente llamada `PWA MIS FINANZAS - fase 2`.
- No se conserva una copia de respaldo.
