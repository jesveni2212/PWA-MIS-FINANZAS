# Diseño de Fase 2 — Identidad y seguridad

**Fecha:** 2026-08-21  
**Estado:** aprobado para planificar  
**Alcance:** registro público autogestionado, autenticación, perfiles iniciales,
espacios personales y aislamiento de datos.

## 1. Decisión tecnológica

La aplicación utilizará Supabase como PostgreSQL administrado y proveedor de
identidad. Esta decisión sustituye la previsión inicial de Auth.js: Supabase
Auth proporciona de forma integrada correo y contraseña, confirmación de
correo, restablecimiento de contraseña y proveedores OAuth, mientras que su
PostgreSQL permite aplicar Row Level Security (RLS) a los datos de negocio.

La app de Next.js usará los clientes oficiales de Supabase para navegador y
servidor con sesiones almacenadas en cookies. Un `proxy.ts` renovará la sesión
antes de renderizar rutas privadas. Los secretos solo existirán en variables de
entorno de desarrollo y despliegue; nunca en el repositorio ni en el navegador.

## 2. Alcance funcional

### Acceso público

La portada expondrá dos acciones: **Iniciar sesión** y **Quiero ser cliente**.
La segunda abre el registro autogestionado. Una persona podrá crear una cuenta
con correo y contraseña o usar Google o Apple.

El registro por correo requiere confirmación mediante un enlace enviado por
Supabase. Una cuenta queda activa de manera automática cuando confirma su
correo; no existe aprobación manual de administrador. Google y Apple se
consideran identidades verificadas por su proveedor, sujetas a la configuración
OAuth correspondiente.

La pantalla de acceso incluirá correo/contraseña, Google, Apple y el enlace
**Olvidé mi contraseña**. La recuperación envía un enlace de un solo uso para
establecer una contraseña nueva. El usuario autenticado podrá cerrar sesión y
consultar su nombre y correo desde Perfil.

### Primera configuración

Al crearse una identidad confirmada se crea exactamente un perfil interno, un
espacio financiero personal y una membresía de rol `owner`. Este proceso debe
ser idempotente: reintentos, redirecciones OAuth y dobles cargas no crearán
espacios duplicados.

La Fase 2 no crea grupos, cuentas, movimientos ni datos financieros. Deja las
tablas y contratos mínimos que las próximas fases usarán para asignar esos datos
a un espacio.

## 3. Modelo de datos y autorización

```text
auth.users (Supabase)
  └── profiles (1:1, id = auth.users.id)
        └── financial_spaces
              └── memberships (profile_id, space_id, role)
```

- `profiles`: identidad de producto asociada uno a uno a `auth.users`; conserva
  nombre visible opcional, correo de referencia y fechas de auditoría.
- `financial_spaces`: contenedor privado con `kind = personal`; la ampliación
  posterior permitirá espacios compartidos sin alterar las claves actuales.
- `memberships`: vincula un perfil con un espacio. En esta fase solo se genera
  `owner`; la futura fase de grupos añadirá `admin` y `member`.

Las tablas de aplicación tendrán RLS activado. Las políticas permitirán ver y
actualizar el propio perfil, y leer un espacio únicamente si la identidad de la
sesión posee una membresía en él. La inserción de perfiles, espacios y
membresías iniciales ocurrirá dentro de una función o disparador transaccional
privilegiado; el navegador no podrá asignarse roles ni elegir espacios ajenos.

Todo endpoint, Server Action o consulta de servidor que posteriormente reciba
un `spaceId` deberá resolver el usuario de la sesión y comprobar su membresía.
RLS es defensa en profundidad, no un reemplazo de esa verificación del servidor.

## 4. Rutas y navegación

- Públicas: `/`, `/acceso`, `/registro`, `/recuperar-contrasena` y las rutas de
  confirmación/callback necesarias para Supabase.
- Privadas: `/resumen`, `/movimientos`, `/grupos` y `/perfil`.
- Una visita anónima a una ruta privada se redirige a `/acceso` conservando una
  ruta de retorno local y validada.
- Una visita autenticada a acceso, registro o recuperación se redirige a
  `/resumen`.
- Tras confirmar correo o terminar OAuth, la persona llega a `/resumen`.

El shell de Fase 1 se adapta: los destinos privados dejan de ser marcadores
públicos y la navegación se muestra dentro del área autenticada. La portada se
mantiene pública y no revela información financiera.

## 5. Errores y privacidad

- Formularios con validación accesible de correo y contraseña; el servidor es
  siempre la autoridad final.
- Mensajes uniformes en acceso y recuperación para no revelar si un correo está
  registrado.
- Errores de OAuth y enlaces vencidos explican cómo reintentar sin mostrar
  tokens, URLs sensibles ni detalles internos.
- Las URL de retorno se limitan a rutas internas permitidas para evitar
  redirecciones abiertas.
- Las claves de servicio de Supabase se reservan para migraciones y tareas de
  administración de servidor; las políticas RLS no se omiten en código de
  producto.
- Los proveedores sociales se muestran operativos solo cuando sus credenciales
  y URLs de callback estén configuradas. En desarrollo sin esas variables, la
  interfaz los deshabilita con una explicación no sensible.

## 6. Configuración requerida

Se documentarán, sin valores reales, las variables de Supabase para URL,
publishable key y, solo si una operación de servidor lo requiere, secret key.
La configuración del panel de Supabase deberá incluir URL de sitio y URLs de
redirección de desarrollo y producción, confirmación de correo, plantilla de
correo y credenciales OAuth de Google y Apple. La aplicación funcionará
localmente con correo/contraseña cuando se proporcione un proyecto Supabase;
Google y Apple requieren que el responsable del proyecto cargue sus
credenciales en Supabase.

## 7. Verificación

- Pruebas unitarias para validadores, rutas de retorno permitidas y contratos
  de autorización.
- Pruebas de integración sobre las políticas/consultas para demostrar que dos
  usuarios no pueden leer ni modificar perfiles, espacios o membresías ajenos.
- Pruebas E2E para rutas públicas, registro, estado pendiente de confirmación,
  callback simulado, acceso, recuperación, cierre de sesión y protección de
  rutas privadas.
- Las pruebas no usarán credenciales reales de Google, Apple ni correo. Los
  proveedores y llamadas externas se simularán; una lista de comprobación
  manual documentará la prueba con credenciales configuradas antes de publicar.

## 8. Fuera de alcance

No se implementan grupos compartidos, roles `admin`/`member`, movimientos,
cuentas, categorías, OCR, notificaciones, facturación ni aprobación manual de
usuarios. Estas capacidades pertenecen a fases posteriores.

## 9. Criterios de aceptación

1. Una persona puede registrarse, verificar su correo, iniciar sesión,
   recuperar su contraseña y cerrar sesión.
2. Google y Apple tienen flujos y callbacks preparados, y solo se habilitan
   cuando su configuración esté presente.
3. Una identidad confirmada tiene un único perfil, espacio personal y
   membresía `owner`.
4. Rutas privadas no son accesibles sin sesión.
5. Ningún usuario puede leer, modificar o asociarse a un perfil, espacio o
   membresía de otra persona.
6. La validación automatizada existente sigue pasando, junto con las nuevas
   pruebas de identidad y autorización.
