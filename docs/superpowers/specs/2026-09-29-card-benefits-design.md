# Diseño aprobado — beneficios de tarjetas y promociones

**Fecha:** 2026-09-29  
**Estado:** pendiente de revisión del documento antes de planificar la implementación.

## 1. Objetivo

Agregar una sección `Beneficios` a la PWA para que cada usuario pueda cargar
manualmente promociones mensuales asociadas a sus tarjetas y consultar el
consumo de cada promoción. Al registrar un egreso con tarjeta, el sistema debe
detectar automáticamente si coinciden la tarjeta, el comercio, el día y la
vigencia, y calcular el consumo sin pedir una confirmación adicional.

La primera versión no consultará bancos ni hará scraping en tiempo real. Las
promociones se cargarán desde un formulario configurable. Cada promoción
conservará el enlace oficial y la fecha de verificación como fuente.

## 2. Alcance aprobado

### Incluido

- Nuevo destino de navegación: `Beneficios`.
- Beneficios personales asociados a cuentas de tipo tarjeta de crédito.
- Carga, edición, desactivación y duplicación de promociones mensuales.
- Selección de tarjeta a partir de las tarjetas que ya tiene cargadas el usuario.
- Estado vacío cuando no existen tarjetas de crédito.
- Error separado cuando no se pudieron cargar las tarjetas.
- Promociones de reintegro porcentual para la primera versión.
- Cálculo automático del tope de reintegro:
  `tope de compra × porcentaje`.
- Consumo separado para tope de compra y tope de reintegro.
- Coincidencia automática al cargar egresos.
- Fuente, condiciones, fechas de vigencia y estado de la promoción.
- Persistencia de la aplicación calculada para conservar el resultado histórico.
- Reutilización de una promoción del período anterior mediante duplicación.

### Fuera de alcance inicial

- Lectura automática de sitios de bancos o comercios desde la aplicación.
- APIs bancarias, sincronización de movimientos bancarios u OCR de promociones.
- Confirmación automática del reintegro real en el banco.
- Registro del reintegro estimado como dinero disponible o ingreso real.
- Promociones de cuotas, puntos o millas; se podrán agregar al modelo luego.
- Beneficios compartidos entre miembros de grupos.

Los enlaces que el usuario comparta durante la preparación del proyecto podrán
usarse para estructurar la carga inicial, pero el runtime de la aplicación no
dependerá de leerlos para calcular cada movimiento.

## 3. Experiencia de usuario

### Navegación

El shell incluirá `Beneficios` junto a los destinos financieros existentes. La
ruta mostrará los beneficios agrupados por tarjeta, con selector de período y
un estado visible para promociones vigentes, próximas a vencer, vencidas o en
borrador.

Cada tarjeta de beneficio mostrará:

- tarjeta y entidad;
- comercio y días válidos;
- porcentaje de reintegro;
- compras computables usadas y restantes;
- reintegro estimado usado y restante;
- vigencia, condiciones y fuente;
- estado de la promoción.

### Formulario de promoción

El formulario seleccionará la tarjeta desde las cuentas de crédito existentes
del espacio personal. No solicitará número completo, CVV ni credenciales del
banco.

Campos de la primera versión:

- tarjeta;
- comercio canónico y alias opcionales;
- días válidos;
- periodicidad y fechas de vigencia;
- tipo `reintegro`;
- porcentaje;
- tope de compra;
- moneda;
- canal válido;
- condiciones;
- enlace de fuente;
- estado.

El tope de reintegro no será un campo editable en el flujo normal: se derivará
automáticamente a partir del porcentaje y del tope de compra. La interfaz
deberá mostrar la fórmula y el resultado antes de guardar.

Si no hay tarjetas cargadas, el formulario mostrará un estado vacío con una
acción para ir a `Cuentas`. Si la consulta falla, mostrará un error técnico
accionable con reintento. No se deben presentar ambos casos como si fueran el
mismo problema.

### Carga de egreso

El formulario de egreso continuará guardando el movimiento sin pasos extra.
Mientras el usuario completa tarjeta, comercio, fecha y monto, se evaluará el
beneficio activo. Si hay coincidencia, el formulario mostrará automáticamente:

- beneficio encontrado;
- monto del gasto;
- compra acumulada nueva y su tope;
- reintegro estimado acumulado y su tope;
- disponible restante para compras;
- disponible restante de reintegro.

No habrá botón `Aplicar beneficio` ni una vista previa que requiera aprobación.
Al guardar el egreso, el cálculo se persistirá junto con el movimiento. Si no
hay coincidencia, el egreso se guardará normalmente y no consumirá topes.

## 4. Modelo de dominio

El diseño reutilizará las cuentas personales existentes y agregará una relación
configurable para beneficios. Los nombres de tablas son conceptuales y se
ajustarán a las convenciones actuales de Supabase.

### Perfil de tarjeta

Un perfil identifica la combinación configurable de entidad, producto y red de
tarjeta. Una cuenta de crédito podrá referenciar un perfil. La cuenta seguirá
siendo la autoridad para pertenencia y autorización del usuario.

Campos conceptuales:

- `id`;
- `institution`;
- `product_name`;
- `network` opcional;
- `active`.

La cuenta personal mantendrá sus datos actuales y tendrá una referencia
opcional al perfil. Esto permite que una promoción se configure para una
tarjeta concreta sin almacenar datos sensibles del plástico.

### Comercio y alias

El sistema usará un nombre canónico de comercio y alias normalizados. La
normalización inicial convertirá a minúsculas, eliminará acentos, espacios
duplicados y puntuación irrelevante. Los alias explícitos serán necesarios para
casos como `Biggie`, `Biggie Express` o variaciones que no puedan resolverse
con seguridad.

### Promoción

En la primera versión, el formulario guardará la cuenta de tarjeta exacta que
el usuario seleccionó. El perfil reutilizable queda preparado para una fase
posterior, pero no se expondrá como una segunda fuente de coincidencias que
pueda duplicar consumos.

Una promoción tendrá, como mínimo:

- `id` y `space_id`;
- cuenta de tarjeta objetivo;
- comercio canónico y alias;
- `benefit_type = rebate`;
- porcentaje expresado con precisión decimal segura;
- `purchase_cap` en unidades enteras de la moneda;
- moneda;
- periodicidad;
- días válidos;
- `valid_from` y `valid_until`;
- canal y condiciones;
- URL de fuente y `source_checked_at`;
- estado: `draft`, `active`, `expired` o `disabled`;
- timestamps.

El `rebate_cap` se derivará como `purchase_cap × rate` en el dominio. Los
importes se manejarán con enteros o tipos exactos, nunca con punto flotante.
Si en una fase posterior se necesitan promociones cuyo tope de reintegro sea
independiente del tope de compra, se agregará un override explícito sin alterar
la experiencia normal de esta versión.

### Aplicación sobre movimiento

Cada coincidencia persistida conservará una fotografía del cálculo, como:

- movimiento y promoción;
- monto del movimiento;
- monto computable para el tope de compra;
- reintegro estimado;
- topes y saldos resultantes;
- fecha de cálculo;
- estado estimado o revisado.

La fotografía evita que modificar una promoción futura cambie el resultado
histórico de una compra pasada.

## 5. Motor de coincidencia y cálculo

El evaluador recibirá el espacio del usuario, la cuenta/tarjeta, el comercio,
el monto y la fecha efectiva del egreso.

Una promoción será candidata si:

1. pertenece al espacio autorizado;
2. la cuenta de origen es una tarjeta de crédito elegible;
3. la promoción está activa y la fecha está dentro de su vigencia;
4. el día de la semana coincide;
5. la moneda y el canal son compatibles;
6. el comercio coincide con el nombre canónico o un alias.

El día se interpretará con la zona horaria de la aplicación, actualmente
`America/Asuncion`, y la fecha del movimiento será la fecha de compra, no la
fecha posterior de pago de la tarjeta.

Para cada promoción se calculará:

```text
compra_computable = mínimo(monto, tope_compra_restante)
reintegro = mínimo(compra_computable × porcentaje, tope_reintegro_restante)
```

Cuando el movimiento supere el tope restante, solo la parte elegible consumirá
el límite. El resto de la compra continuará siendo un gasto válido, pero no
incrementará el consumo de la promoción.

En la primera versión se espera una única promoción objetivo por cuenta,
comercio y período. Antes de activar una promoción, se rechazará un duplicado
exacto de cuenta, comercio, días y vigencia. Si aun así existen varias
coincidencias, se elegirá la regla más específica; si hay empate, no se
aplicará ningún beneficio automáticamente, se mostrará una advertencia y el
egreso se guardará sin consumir topes. Nunca se contará dos veces el mismo
movimiento.

## 6. Persistencia, API y seguridad

La lectura y mutación se implementarán mediante las mismas fronteras de servidor
que ya usa el ledger personal. El servidor será la autoridad del cálculo; el
cliente solo mostrará una proyección durante la edición del formulario.

Se necesitarán operaciones conceptuales para:

- listar tarjetas disponibles;
- listar promociones por período;
- crear, editar, duplicar, activar y desactivar promociones;
- evaluar una promoción para un egreso;
- persistir la aplicación junto con `record_personal_transaction`;
- recalcular el resumen del período desde aplicaciones persistidas.

Las políticas RLS limitarán promociones y aplicaciones al `space_id` del
usuario autenticado. No se almacenarán números completos de tarjeta, CVV,
credenciales bancarias ni tokens de terceros.

## 7. Offline y consistencia

La configuración de promociones requiere conexión en la primera versión. Las
promociones activas podrán incluirse en la caché financiera del usuario para
mostrar el estado reciente y evaluar egresos offline con la última versión
sincronizada.

Al sincronizar un egreso offline, el servidor volverá a evaluar la regla con la
versión vigente y conservará el resultado autoritativo. Si la regla cambió o
expiró mientras el dispositivo estaba offline, el movimiento no se perderá y
la aplicación marcará la diferencia para revisión.

## 8. Fuentes manuales e incorporación futura

Para la primera versión, pegar un enlace en el formulario solo registra la
fuente. Los datos se introducen o se importan de manera estructurada. No se
hará una petición al enlace en cada carga de movimiento.

Los conectores futuros podrán importar promociones desde APIs, feeds oficiales
u otras fuentes autorizadas. Esos conectores deberán convertir datos externos
al mismo modelo de promoción, validar cambios y mantener historial; el motor de
coincidencia no deberá conocer la fuente original.

## 9. Pruebas y criterios de aceptación

### Unitarias

- cálculo del tope de reintegro derivado;
- consumo parcial y total de ambos topes;
- compra que supera el tope restante;
- coincidencia por día, fecha, tarjeta y alias de comercio;
- promociones vencidas, futuras y desactivadas;
- moneda y zona horaria;
- duplicados y ausencia de coincidencias.

### Componentes

- listado de tarjetas existentes;
- estado sin tarjetas;
- estado de error de carga;
- formulario que recalcula el tope de reintegro;
- cálculo automático dentro del formulario de egreso;
- ausencia de botón o paso de confirmación;
- visualización de compras y reintegros restantes.

### Integración y E2E

- RLS por espacio personal;
- creación y duplicación de promociones;
- registro de egreso con coincidencia;
- registro de egreso sin coincidencia;
- persistencia histórica de la aplicación;
- sincronización offline con reevaluación en servidor;
- navegación a `Beneficios` en móvil y escritorio.

La puerta de calidad será la habitual del proyecto: lint, typecheck, pruebas
unitarias, build y pruebas E2E relevantes.

## 10. Entrega propuesta

La implementación se dividirá en tres bloques:

1. esquema, RLS, tipos y motor de cálculo;
2. sección `Beneficios`, formulario y estados de tarjetas;
3. integración con egresos, cache offline y pruebas de extremo a extremo.

No se agregará una integración automática externa hasta que el catálogo manual
y el cálculo autoritativo estén funcionando y cubiertos por pruebas.
