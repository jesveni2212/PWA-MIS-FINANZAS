# Diseño — detección de configuración pública de Supabase en el navegador

**Fecha:** 2026-09-09  
**Estado:** pendiente de revisión del usuario antes de planificar

## 1. Contexto

Las pantallas de inicio de sesión y registro muestran el aviso de servicio no
configurado incluso cuando el cliente de Supabase recibe valores públicos en el
bundle. La causa es que `isSupabaseConfigured` obtiene su entorno por medio de
`process.env` de forma indirecta. Next.js solo sustituye de manera fiable en el
bundle del navegador las referencias estáticas a variables `NEXT_PUBLIC_*`.

El cambio debe corregir la detección en el cliente sin ocultar una configuración
realmente ausente.

## 2. Objetivo y límites

El objetivo es que los formularios reconozcan las variables públicas de Supabase
generadas durante el build y solo muestren el aviso cuando falte la URL o la
publishable key.

Quedan fuera de alcance:

- crear o modificar variables en Vercel;
- cambiar claves, migraciones, RLS o datos de Supabase;
- modificar el proxy, el callback o la renovación de sesiones;
- activar Google o Apple;
- cambiar el service worker o la interfaz visual.

## 3. Diseño técnico

`src/lib/supabase/config.ts` definirá un objeto de entorno público con
referencias estáticas a:

- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
- `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`;
- `NEXT_PUBLIC_APPLE_AUTH_ENABLED`.

Las funciones `isSupabaseConfigured` e `isProviderEnabled` usarán ese objeto
como valor predeterminado y conservarán el parámetro de entorno explícito para
las pruebas unitarias. Los valores de placeholder seguirán considerándose no
configurados.

El flujo resultante será:

```text
variables Vercel durante el build
          ↓
referencias NEXT_PUBLIC_* estáticas en el bundle
          ↓
isSupabaseConfigured()
     ├─ configurado → createClient() → Supabase Auth
     └─ ausente    → aviso de configuración
```

No se introducirá ninguna clave secreta en el código. La publishable key es la
clave pública destinada al cliente; la clave `service_role` continuará fuera del
frontend.

## 4. Manejo de errores y despliegue

Con variables ausentes, el comportamiento seguro actual se conserva: el
formulario no realiza una llamada ni simula una cuenta. Con variables presentes,
el formulario superará la validación local y mostrará el resultado real de
Supabase.

Para producción, Vercel debe tener `NEXT_PUBLIC_SUPABASE_URL` y
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en los entornos que se prueben. Como las
variables públicas se fijan durante `next build`, cualquier cambio en Vercel
requiere un nuevo deployment.

## 5. Verificación

- Mantener las pruebas de placeholders, valores incompletos y configuración
  válida.
- Añadir una regresión que compruebe que el entorno predeterminado configurado
  reconoce valores públicos estáticos.
- Ejecutar `corepack pnpm typecheck`.
- Ejecutar `corepack pnpm build` y comprobar que el bundle cliente contiene la
  URL pública para la validación.
- Probar manualmente el botón de inicio de sesión y el registro con el build
  local configurado: ya no debe aparecer el aviso antes de contactar a
  Supabase.
- Confirmar en Vercel que, tras configurar variables y redeployar, `/acceso` y
  `/registro` tienen el mismo comportamiento.

## 6. Criterios de aceptación

1. Con valores públicos válidos incluidos durante el build, login y registro no
   muestran el aviso de configuración antes de enviar la solicitud.
2. Con valores ausentes, vacíos o placeholder, el aviso se mantiene y no se
   crea ninguna cuenta simulada.
3. Las pruebas existentes y el build de producción pasan.
4. No se exponen claves secretas ni se alteran los flujos SSR de sesión.
