# Diseño aprobado — Invitaciones de grupos y fotos de perfil

## Objetivo

Permitir que una persona cree grupos compartidos seleccionando integrantes registrados y genere un enlace general reutilizable. El enlace debe ser seguro, tener vencimiento y no revelar datos del grupo antes de que la persona invitada se autentique y acepte.

El perfil también permitirá subir, reemplazar y eliminar una foto. La foto será visible únicamente para usuarios autenticados de la aplicación cuando busquen integrantes o compartan un grupo.

## Alcance y privacidad

- El directorio de integrantes solo estará disponible para usuarios autenticados.
- La búsqueda devolverá únicamente identidad mínima: `id`, nombre visible, correo parcialmente protegido y avatar.
- No se mostrarán saldos, movimientos, cuentas ni otra información financiera durante la búsqueda.
- Usuarios externos no podrán consultar perfiles ni descargar fotos.
- Las fotos se almacenarán en un bucket privado y se servirán mediante URLs temporales o acceso controlado.
- El usuario podrá reemplazar o eliminar su foto desde Perfil.

## Invitaciones de grupo

### Modelo de seguridad

Cada enlace general se respaldará con una invitación que contiene:

- grupo asociado;
- creador;
- hash del token, nunca el token en texto plano;
- fecha de creación y vencimiento;
- estado activo o revocado;
- cantidad de usos y último uso.

El enlace contendrá únicamente un token aleatorio opaco. No incluirá el ID, nombre ni información del grupo. El servidor validará autenticación, token, vencimiento, revocación y límites de intentos. Los enlaces no podrán otorgar roles de administrador o propietario.

El propietario podrá revocar el enlace y generar otro. La aceptación será idempotente: si la persona ya pertenece al grupo, no se duplicará la membresía.

### Flujo

1. La persona autenticada introduce el nombre del grupo.
2. Busca personas registradas por nombre o correo.
3. Selecciona integrantes, visualizando avatar y nombre.
4. Puede quitar integrantes antes de crear el grupo.
5. Después de crear el grupo, se muestra el enlace, su vencimiento y las acciones copiar, revocar y regenerar.
6. La persona invitada abre el enlace y ve una pantalla neutra sin datos del grupo.
7. Si no está autenticada, se dirige a acceso o registro y se conserva el retorno a la invitación.
8. El servidor valida el token después de la autenticación.
9. Al aceptar, crea la membresía con rol `integrante`.
10. Solo después de aceptar se muestran el nombre y los datos autorizados del grupo.

### Estados

- Enlace válido: invitación disponible y acción “Aceptar invitación”.
- Enlace vencido o revocado: invitación no disponible.
- Usuario ya integrante: mensaje informativo sin duplicar acceso.
- Token inválido o demasiados intentos: mensaje genérico.
- Invitación aceptada: confirmación y acceso al grupo.

## Perfil y fotos

El perfil tendrá avatar actual o iniciales como fallback, además de controles para subir, reemplazar y eliminar la foto. La interfaz mostrará vista previa, carga, éxito y error sin perder los demás campos del formulario.

El servidor validará formato y tamaño antes de almacenar. La imagen se recortará o presentará como avatar uniforme. Las URLs de acceso estarán restringidas a usuarios autenticados; la eliminación deberá borrar también el objeto almacenado cuando corresponda.

## Componentes y datos

- `CreateGroupForm`: nombre, búsqueda, selección y creación del grupo.
- `MemberSearch`: consulta autenticada de usuarios registrados con avatar mínimo.
- `GroupInvitePanel`: copia, vencimiento, revocación y regeneración del enlace.
- `GroupInvitePage`: pantalla neutra, autenticación, validación y aceptación.
- `ProfileForm`: edición de nombre y controles de avatar.
- Capa de datos del módulo `groups` para búsquedas, invitaciones y aceptación.
- Capa de datos del módulo `profile` para carga y eliminación de avatar.

La capa de datos no expondrá errores internos de base de datos ni tokens. La autorización definitiva permanecerá en el servidor, RLS y las operaciones transaccionales correspondientes.

## Pruebas y criterios de aceptación

- Usuario autenticado puede buscar personas registradas.
- Usuario no autenticado no puede consultar directorio ni fotos.
- La búsqueda no expone información financiera.
- El propietario crea un grupo y genera un enlace reutilizable.
- El enlace válido permite aceptar después de iniciar sesión.
- Enlaces vencidos, revocados o inválidos no conceden acceso.
- No se duplica una membresía existente.
- No se muestran datos del grupo antes de aceptar.
- Revocar y regenerar invalida el enlace anterior.
- Los intentos excesivos reciben una respuesta genérica.
- El avatar válido se sube, reemplaza y elimina.
- Archivos inválidos se rechazan sin romper el formulario.
- Los flujos completos pasan pruebas unitarias, E2E, lint, typecheck y build.

## Fuera de alcance

- Directorio público o URLs públicas permanentes.
- Invitaciones que asignen roles administrativos.
- Acceso a información financiera antes de aceptar.
- Sincronización de contactos del teléfono.
- Edición o eliminación de grupos en esta tarea.
