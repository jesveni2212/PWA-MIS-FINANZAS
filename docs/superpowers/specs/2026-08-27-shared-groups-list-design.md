# Lista de grupos compartidos

## Objetivo

Completar la primera entrega de grupos compartidos mostrando los grupos a los
que pertenece la persona autenticada y actualizando esa lista al crear uno.

## Alcance

- La ruta privada `/grupos` mostrará el formulario de creación y una lista de
  espacios con `kind = 'shared'` visibles para la sesión actual.
- La lista se consultará mediante el cliente de navegador de Supabase. Las
  políticas RLS existentes determinan cuáles filas puede devolver la consulta.
- Al crear un grupo con la RPC `create_shared_group`, la vista volverá a
  consultar la lista y mostrará el nuevo resultado sólo cuando la operación
  termine correctamente.
- La interfaz tendrá estados de carga, vacío y error; no incluirá el espacio
  personal `Mis finanzas`.

No se implementan invitaciones, miembros, roles editables, detalle del grupo,
movimientos compartidos ni una actualización optimista.

## Arquitectura y flujo

`GruposPage` continúa siendo responsable de proteger la ruta en el servidor.
Un componente de cliente dedicado obtiene `financial_spaces`, filtrado por
`kind = 'shared'` y ordenado de forma estable. El componente entrega una
función de recarga al formulario.

1. Al montarse, el componente consulta los grupos permitidos por RLS.
2. Mientras consulta, muestra una indicación de carga sin presentar la lista
   como vacía.
3. Si no recibe filas, informa que todavía no hay grupos compartidos.
4. El formulario valida el nombre y llama a la RPC transaccional existente.
5. Tras éxito, conserva su confirmación y solicita una nueva consulta; ante un
   error mantiene los campos y comunica una acción segura para reintentar.

La creación permanece encapsulada en la RPC porque inserta el espacio y su
membresía de propietario en una única operación. El cliente no inserta filas
en `memberships` directamente ni usa claves privilegiadas.

## Errores y accesibilidad

- Los mensajes de carga, vacío, éxito y error usan regiones anunciables.
- Los controles permanecen deshabilitados sólo durante la creación; una falla
  al listar no impide intentar crear un grupo.
- La lista usa estructura semántica y muestra el nombre de cada grupo.
- Los mensajes para problemas de red o sesión son generales y no exponen
  detalles internos de Supabase.

## Pruebas

- Prueba de componente para la consulta inicial, estado vacío y error de carga.
- Prueba para confirmar que una creación correcta solicita la recarga y que un
  error no borra el nombre ni altera la lista.
- Se mantienen las pruebas SQL de RLS y de la RPC para comprobar que cada
  persona sólo ve los espacios donde tiene membresía.
- Al cierre se ejecutarán lint, typecheck, pruebas unitarias y build.

## Criterios de aceptación

- Una persona autenticada ve únicamente sus grupos compartidos.
- Al crear un grupo válido, aparece en la lista tras la recarga confirmada.
- La lista vacía, la carga y un error se entienden sin consultar la consola.
- Un fallo de creación conserva el texto escrito y permite reintentar.
