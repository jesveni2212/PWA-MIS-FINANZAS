# Contexto maestro / prompt de continuidad — Mis Finanzas

Usa este documento como contexto base al trabajar en este repositorio. Respeta
`CODEX.md` y actualiza `docs/implementation-phases.md` al cerrar cada fase.

## Visión

Mis Finanzas es una PWA personal y escalable para iPhone y computadoras. Ayuda
a usuarios a administrar finanzas propias y compartidas, registrando ingresos,
gastos, deudas, cuentas, vencimientos y liquidaciones. Debe sentirse como una
app nativa: rápida, clara, responsive y segura.

## Usuarios y espacios

- Toda persona debe iniciar sesión para usar la aplicación.
- Métodos de acceso: correo/contraseña, Google y Apple.
- Cada usuario puede crear espacios personales y grupos compartidos.
- En los grupos hay propietario, administrador e integrante; nadie puede leer
  ni modificar información de un espacio donde no tenga membresía.

## Alcance funcional aprobado

- Dashboard mensual como página inicial: saldo, ingresos, gastos y próximos
  vencimientos.
- Botón global para alta rápida: centrado en la navegación inferior móvil y en
  la parte superior de escritorio.
- Cuentas, ingresos, gastos, gastos fijos, categorías y deudas editables.
- PYG y USD almacenados por cuenta y movimiento, sin conversiones implícitas.
- Gastos compartidos con pagador, reparto por integrante y balance resultante.
- Liquidaciones manuales entre integrantes que conservan el historial.
- Búsqueda por texto/título, comercio, mes, año, fecha, monto, moneda,
  categoría, cuenta e integrante. Un ejemplo válido de título es
  `Biggie 20/07/2026`.
- OCR de comprobantes: una foto temporal genera sugerencias de comercio, fecha
  y monto; el usuario confirma o corrige y la imagen se elimina, sin persistir
  en la base de datos.
- Recordatorios de pagos y gastos fijos mediante Web Push, solicitando permiso
  tras una acción directa del usuario. En iPhone se debe guiar a instalar la
  PWA en pantalla de inicio.

## Stack inicial aprobado

- Next.js + React + TypeScript + Tailwind CSS.
- PWA con manifest y service worker.
- Vercel para frontend, API y tareas cron.
- PostgreSQL administrado; elegir proveedor concreto durante el despliegue.
- Auth.js para autenticación y proveedores OAuth.
- Servicio de correo y Web Push desacoplados.
- GitHub privado como fuente de verdad y despliegue automático.

## Restricciones de producto

- Inicio aproximado: hasta diez usuarios.
- Evitar VPS inicialmente para reducir costo y operación; documentar una ruta
  de migración a infraestructura propia cuando aumente el uso.
- No procesar pagos reales ni conexiones bancarias en la primera versión.
- No persistir las fotos de facturas tras el OCR.

## Criterios de éxito

1. Una persona puede registrarse, crear su espacio, registrar movimientos PYG
   o USD y entender su mes en menos de un minuto.
2. Un grupo puede registrar un gasto, distribuirlo y consultar cuánto debe cada
   integrante sin cálculos manuales.
3. Un recordatorio llega con permiso explícito y dirige al vencimiento.
4. Los datos de otros usuarios o grupos nunca son visibles ni editables.
5. Cada decisión y fase queda registrada y verificable.
