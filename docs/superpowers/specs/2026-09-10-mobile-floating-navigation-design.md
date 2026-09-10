# Navegación móvil flotante y acceso a Perfil

**Estado:** diseño aprobado por el usuario el 2026-09-10.

## Objetivo

Mejorar la navegación en iPhone y otros móviles para que los objetivos táctiles de la barra inferior sean más cómodos y no queden pegados al gesto del sistema. El acceso a Perfil pasará a un avatar visible en la cabecera superior.

## Alcance

- En móvil, la barra inferior mostrará las cinco áreas principales: Inicio, Cuentas, Movimientos, Grupos y Recordatorios.
- En móvil, Perfil dejará de ocupar un lugar en la barra inferior y se abrirá desde un avatar en la cabecera superior derecha.
- La barra inferior será flotante: tendrá bordes redondeados, separación visual del borde de la pantalla y una posición calculada con `env(safe-area-inset-bottom)`.
- Los enlaces de navegación tendrán áreas táctiles de al menos 44 px, iconos ligeramente mayores y etiquetas legibles.
- El contenido principal tendrá espacio inferior suficiente para no quedar oculto por la barra flotante.
- En escritorio se conservará la barra lateral actual, incluido el enlace a Perfil.
- El control de ocultar/mostrar saldos conservará su comportamiento y quedará separado de la barra flotante.

## Experiencia y comportamiento

### Cabecera móvil

La cabecera seguirá mostrando el nombre de la aplicación, el saludo y el estado de sincronización. A la derecha incluirá un enlace circular con el avatar del usuario:

- usará las iniciales del nombre disponible cuando exista;
- tendrá un fallback visual con el icono de usuario cuando no haya nombre;
- enlazará a `/perfil`;
- tendrá un nombre accesible estable, por ejemplo `Perfil`, y foco visible;
- conservará un estado activo cuando la ruta actual sea `/perfil` o una subruta de Perfil.

### Navegación flotante

La navegación móvil se renderizará como un panel fijo sobre el borde inferior, con un margen inferior aproximado de `0.75rem` además del área segura del dispositivo. El panel tendrá cinco columnas, altura suficiente para icono, etiqueta y foco, y mantendrá los estados activo, hover y focus existentes.

La posición conceptual será:

```css
bottom: calc(env(safe-area-inset-bottom) + 0.75rem);
```

El panel no dependerá únicamente del padding del sistema: la separación será visible también en dispositivos sin `safe-area-inset-bottom`. El indicador de inicio del iPhone quedará fuera del panel.

### Saldos y contenido

El botón de ocultar saldos permanecerá encima de la navegación, con suficiente separación para no tapar el panel ni competir con el avatar de Perfil. El `main` aumentará su padding inferior para que el último contenido desplazable pueda quedar por encima de la navegación.

## Arquitectura de componentes

- `AppShell` seguirá siendo la fuente única de la navegación y del estado activo basado en `usePathname`.
- Se reutilizará la configuración de `site.navigation`; la exclusión de Perfil será únicamente para la presentación móvil.
- Se extraerá, si resulta necesario para evitar markup duplicado, un enlace de navegación compartido que mantenga el mismo contrato de accesibilidad y estilo en móvil y escritorio.
- No se cambiarán rutas, permisos, consultas de Supabase ni el comportamiento de sincronización financiera.

## Accesibilidad y responsive

- La navegación conservará `aria-label="Navegación principal"` y los enlaces conservarán `aria-current="page"` en la ruta activa.
- El avatar de cabecera será un enlace real, no solo un botón visual, y tendrá un área táctil mínima de 44 px.
- Los cinco enlaces inferiores tendrán foco visible y objetivos táctiles mínimos de 44 px.
- El layout móvil se probará con anchos pequeños, incluyendo 320 px, para confirmar que `Recordatorios` no rompe la barra.
- En `lg` y superiores se mantendrá la sidebar vertical sin aplicar el tratamiento flotante móvil.

## Validación

- Actualizar las pruebas unitarias de `AppShell` para comprobar el avatar de Perfil, la ausencia de Perfil en la colección móvil y la presencia de los cinco enlaces principales.
- Verificar que la ruta `/perfil` active el avatar y que las rutas existentes sigan marcando correctamente el enlace correspondiente.
- Verificar que el control de saldos siga persistiendo su preferencia.
- Ejecutar `test`, `typecheck`, `lint` y `build`.
- Revisar visualmente la app en viewport móvil y, si es posible, en un iPhone real con gesto inferior activo; comprobar también un viewport de escritorio.

## Fuera de alcance

- Cambiar la identidad visual general, las rutas o la estructura de datos.
- Convertir la navegación en un drawer o menú lateral móvil.
- Modificar la navegación de escritorio.
