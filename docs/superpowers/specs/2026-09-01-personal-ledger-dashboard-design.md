# Diseño aprobado — Dashboard y libro contable personal

## Objetivo

Rediseñar íntegramente PWA Mis Finanzas con una experiencia premium, nocturna y editorial. La aplicación debe mostrar el patrimonio personal de forma simple, registrar operaciones sin duplicar efectos contables y separar claramente las deudas de tarjetas de crédito de las cuentas disponibles.

## Alcance

Esta fase cubre el dashboard, cuentas y tarjetas, registro y listado de movimientos, detalle manual de compras, grupos compartidos y perfil. No incluye OCR de facturas, almacenamiento de imágenes, WhatsApp, sincronización bancaria, presupuestos, límites ni vencimientos de tarjetas.

## Dirección visual

- Estética: nocturna editorial; fondo carbón, superficies oscuras con contraste suave y verde-lima reservado para acciones y estados favorables.
- Tipografía: jerarquía expresiva para importes y títulos; cuerpo legible y sobrio.
- Interacción: transiciones discretas, botones táctiles generosos y acciones de alto impacto concentradas en un botón `+`.
- Accesibilidad: contraste suficiente, textos de estado anunciables, navegación por teclado y controles con nombre accesible.

## Arquitectura de información

### Inicio

El dashboard prioriza una lectura en este orden:

1. Saludo y período actual.
2. Patrimonio neto personal, con control para ocultar visualmente los importes en el dispositivo.
3. Desglose corto de dinero disponible y deuda total.
4. Tarjetas por pagar, con deuda actual o estado `Al día`.
5. Acciones rápidas: gasto, ingreso y transferencia/pago de tarjeta.
6. Últimos movimientos con tipo, cuentas involucradas y efecto comprensible.

Los grupos compartidos no forman parte del patrimonio y se acceden desde una sección independiente.

### Cuentas y tarjetas

Las cuentas se agrupan como `Disponible` (efectivo, cajas de ahorro y cuentas bancarias) y `Tarjetas de crédito` (deudas). Al crear una cuenta, la persona elige el tipo, entidad, nombre y saldo o deuda inicial. El selector ofrece una lista inicial de entidades paraguayas —Ueno, GNB, Itaú, Continental, Coomecipar, Fic de Finanzas, Mango y Eko— y una opción `Otro` para escribir una entidad no listada.

Una tarjeta de débito se representa como una cuenta disponible asociada a su entidad. Una tarjeta de crédito se representa como una cuenta de pasivo; su deuda no reduce el disponible hasta que se paga.

### Movimientos

El primer campo del compositor es el tipo de operación, que revela solo los campos necesarios:

| Tipo | Efecto | Campos contables |
| --- | --- | --- |
| Ingreso | aumenta patrimonio | cuenta destino, importe, categoría, fecha, nota |
| Gasto | disminuye patrimonio | cuenta origen, importe, categoría, fecha, nota |
| Compra con tarjeta | aumenta deuda | tarjeta de crédito, importe, categoría, fecha, nota |
| Transferencia | mueve disponible | cuenta origen, cuenta destino, importe, fecha, nota |
| Pago de tarjeta | baja disponible y deuda | cuenta origen, tarjeta de crédito, importe, fecha, nota |

Una transferencia o pago de tarjeta nunca crea un gasto adicional. La lista cronológica usa rótulos explícitos, por ejemplo `Pago de GNB desde Ueno`, para evitar ambigüedad.

### Detalle de compra

Los gastos y compras con tarjeta pueden incluir opcionalmente comercio, fecha e ítems. Cada ítem contiene descripción, cantidad y precio unitario; el total se calcula automáticamente. Si no coincide con el importe del movimiento, la interfaz muestra una advertencia no bloqueante para admitir descuentos, redondeos o detalle parcial.

No se suben ni persisten fotos de facturas. La captura de imágenes y OCR/IA se evaluarán como una fase posterior independiente.

## Modelo contable y datos

La fuente de verdad no son saldos editables: el saldo de cada cuenta se deriva de su saldo inicial y los eventos contables. El patrimonio neto es el total de cuentas disponibles menos la deuda total de tarjetas de crédito.

La migración ampliará el modelo actual para identificar el tipo de cuenta, institución y las cuentas involucradas en cada operación. Las operaciones personales se guardarán mediante una función RPC transaccional de Supabase que:

1. autentica a la persona usuaria;
2. verifica que todas las cuentas pertenecen a su espacio personal;
3. valida tipo, importe positivo y combinación de origen/destino;
4. crea el evento y sus efectos contables juntos;
5. guarda ítems de compra opcionales dentro de la misma operación lógica.

Los movimientos de grupos mantienen su aislamiento actual y no se incluyen en los cálculos personales.

## Estados, errores y seguridad

- Las cargas iniciales muestran esqueletos o estados claros; los fallos ofrecen reintento.
- Un formulario conserva datos e ítems si falla el guardado.
- La interfaz evita confirmar éxito hasta obtener respuesta de Supabase.
- Las políticas RLS y la RPC verifican propiedad de cuentas y membresía de grupos; el cliente nunca usa claves de servicio.
- No se permite una operación incompleta ni cuentas ajenas como origen o destino.

## Criterios de aceptación

- La interfaz completa adopta el lenguaje nocturno editorial y responde bien en móvil y escritorio.
- El patrimonio puede ocultarse visualmente y permanece separado de grupos.
- Una compra con tarjeta aumenta únicamente la deuda de esa tarjeta.
- Un pago de tarjeta reduce simultáneamente disponible y deuda, sin crear un gasto duplicado.
- Los bancos sugeridos y `Otro` funcionan al crear cuentas.
- Los ítems de compra son opcionales, no almacenan imágenes y pueden verse en el detalle del movimiento.
- Las pruebas cubren los efectos de cada tipo de operación, errores de autorización y estados de interfaz principales.

## Fuera de alcance

Lectura automática de facturas, adjuntos de imágenes, integración de WhatsApp, sincronización con entidades, presupuestos, límites de crédito, fechas de cierre y vencimiento, reportes avanzados y automatizaciones.
