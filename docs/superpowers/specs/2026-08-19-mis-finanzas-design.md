# Diseño aprobado — Mis Finanzas

**Fecha:** 2026-08-19  
**Estado:** pendiente de revisión del usuario antes de planificar la Fase 1.

## 1. Resumen

Se construirá una PWA responsive de finanzas personales y compartidas. La
primera versión atenderá aproximadamente hasta diez usuarios, funcionará en
iPhone y computadoras, exigirá inicio de sesión y tendrá una ruta documentada
para escalar desde servicios administrados a infraestructura propia.

## 2. Arquitectura

La aplicación será un monolito modular en TypeScript:

```text
GitHub privado -> Vercel (Next.js PWA, API, cron)
                         |-- Auth.js: correo, Google, Apple
                         |-- PostgreSQL administrado
                         |-- proveedor de correo
                         `-- Web Push
```

Next.js será la interfaz y capa API. Las reglas financieras se separarán de los
componentes y de los detalles de proveedores. La base de datos, autenticación,
correo, push y OCR se consumirán mediante interfaces para sustituir proveedores
o migrar a VPS sin reescribir el dominio financiero.

## 3. Dominios y datos

- `User`: identidad autenticada.
- `FinancialSpace`: contenedor personal o compartido.
- `Membership`: relación usuario-espacio y rol.
- `Account`: cuenta financiera, con moneda PYG o USD.
- `Category`: clasificación editable.
- `Transaction`: ingreso, gasto, deuda u operación relacionada; guarda título,
  fecha, importe exacto, moneda, categoría, cuenta, pagador y notas.
- `RecurringRule` y `Reminder`: gastos fijos, vencimientos y avisos.
- `ExpenseShare`: importe que corresponde a cada integrante de un gasto.
- `Settlement`: pago manual entre integrantes, inmutable y auditable.
- `ReceiptExtraction`: sugerencia temporal de OCR; nunca conserva el archivo
  original como dato de negocio.

Los importes no usarán números de punto flotante. Las conversiones entre PYG y
USD solo existirán si se incorpora explícitamente una cotización, fecha y
política de conversión en una fase futura.

## 4. Flujos críticos

### Registro y acceso

Auth.js gestiona correo/contraseña y OAuth con Google/Apple. El usuario solo
entra a rutas privadas después de autenticarse. Cada operación valida en el
servidor su pertenencia al espacio solicitado.

### Movimiento rápido y OCR

El botón global `+` abre un formulario. El usuario puede ingresar un gasto a
mano o seleccionar una foto temporal. El OCR genera un borrador de comercio,
fecha y monto. La persona confirma/corrige; solo entonces se escribe el
movimiento. La imagen temporal se elimina.

### Gastos compartidos

Una persona registra pagador, importe y reparto. El sistema crea las porciones
por integrante y calcula balances. Un pago manual crea una liquidación nueva,
que reduce deuda sin borrar el gasto original.

### Recordatorios

El usuario concede permiso tras tocar una acción clara. El cron identifica
vencimientos y envía Web Push. En iPhone el onboarding explica que debe añadir
la PWA a la pantalla de inicio para recibirlos.

## 5. Interfaz

El dashboard mensual será la entrada principal. En móvil existe una navegación
inferior y el `+` centrado; en escritorio la acción vive en la barra superior.
La UI será móvil primero, accesible, con jerarquía visual financiera clara y
sin saturación. El logo raíz se utilizará al diseñar la identidad visual.

## 6. Errores, seguridad y privacidad

- Validación en cliente para ayudar y en servidor como autoridad.
- Errores accionables, sin filtrar detalles técnicos ni datos sensibles.
- Autorización por espacio/membresía en todas las consultas y mutaciones.
- Limitación de tamaño y formatos para OCR; archivos temporales eliminados tras
  procesamiento y nunca añadidos a backups de negocio.
- Secretos en variables de entorno; logs estructurados sin datos financieros.
- Copias de seguridad y restauración probada antes de producción.

## 7. Calidad

Pruebas unitarias para cálculos, repartos, balances, recurrencias, monedas y
permisos; pruebas de integración para persistencia y API; y pruebas de extremo
a extremo para acceso, movimientos, OCR, búsqueda, liquidaciones y
notificaciones. Se validarán accesibilidad, PWA y flujos principales en iPhone
y escritorio.

## 8. Entregas

Las fases oficiales están en `docs/implementation-phases.md`. La primera tarea
de implementación será planificar en detalle la Fase 1; no se inicia código de
producto hasta que el usuario revise y apruebe esta especificación.
