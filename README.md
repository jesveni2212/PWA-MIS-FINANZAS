# Mis Finanzas

Mis Finanzas es una PWA privada para organizar finanzas personales y compartidas desde el celular o el navegador.

## Qué permite hacer

- Crear y administrar cuentas personales.
- Registrar ingresos, gastos, pagos de tarjeta y compras detalladas.
- Consultar patrimonio, saldos y movimientos recientes.
- Crear grupos compartidos y elegir sus integrantes registrados.
- Buscar integrantes por nombre o correo dentro de la aplicación.
- Compartir grupos mediante enlaces de invitación reutilizables con token, vencimiento y revocación.
- Aceptar invitaciones sin exponer datos del grupo antes de la aceptación.
- Administrar el perfil y subir una foto visible para otros usuarios autenticados.
- Instalarse como PWA en dispositivos compatibles.

## Tecnologías

- Next.js 16, React 19 y TypeScript.
- Supabase Auth, PostgreSQL, Row Level Security y Storage.
- Tailwind CSS.
- Vitest y Testing Library para pruebas unitarias.
- Playwright para pruebas E2E en desktop, iPhone y Android.

## Ejecutar localmente

Requisitos: Node.js, Corepack y una instancia de Supabase.

```powershell
corepack enable
corepack pnpm install
Copy-Item .env.example .env.local
corepack pnpm dev
```

La aplicación queda disponible en `http://localhost:3000`.

## Variables de entorno

Completar `.env.local` con:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu-clave-publicable
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false
NEXT_PUBLIC_APPLE_AUTH_ENABLED=false
```

`.env.local` no debe subirse al repositorio.

## Base de datos

Las migraciones se encuentran en `supabase/migrations/`. Para aplicar las pendientes al proyecto vinculado:

```powershell
corepack pnpm exec supabase db push
```

Las políticas de seguridad y pruebas SQL están en `supabase/tests/`.

## Verificación

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm test:e2e
```

La suite E2E se ejecuta en desktop, iPhone y Android.

## Despliegue

El proyecto puede desplegarse en Vercel conectado al repositorio de GitHub. En producción se deben configurar las variables de entorno, el dominio público en `NEXT_PUBLIC_APP_URL` y las URLs de redirección de Supabase Auth.

## Alcance actual

La aplicación cubre la primera versión funcional de finanzas personales, grupos compartidos, invitaciones seguras, perfiles con avatar, recordatorios recurrentes y experiencia PWA. Las integraciones OAuth y funciones financieras avanzadas pueden incorporarse en etapas posteriores.

## Experiencia offline y medición

Las cuentas y movimientos personales recientes se guardan en IndexedDB por usuario. Sin conexión se pueden consultar los datos guardados y registrar movimientos; la creación de cuentas, grupos, invitaciones y cambios de perfil requieren conexión. La cola conserva el orden y sincroniza cada movimiento con un identificador idempotente. Al cerrar sesión se elimina la caché financiera del usuario activo.

El Service Worker solo almacena recursos públicos estáticos versionados; nunca guarda HTML personalizado ni respuestas de Supabase.

Para medir la experiencia completa:

```powershell
corepack pnpm test:e2e
corepack pnpm build
```

Compará antes y después el TTFB, el tiempo hasta ver el dashboard, la navegación entre rutas y los kilobytes de JavaScript transferidos en móvil. Los flujos autenticados E2E usan `E2E_TEST_EMAIL` y `E2E_TEST_PASSWORD`; si no están definidos, se omiten con una explicación clara.

## Recordatorios y notificaciones

Los recordatorios se crean desde `Recordatorios` y admiten repetición semanal, mensual, anual o personalizada. La notificación del navegador solo se solicita al pulsar `Activar` desde `Perfil`; si no se concede permiso, los recordatorios siguen visibles dentro de la aplicación.

Para habilitar las notificaciones push en producción:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@tu-dominio.com
REMINDER_SCHEDULER_SECRET=...
```

`NEXT_PUBLIC_VAPID_PUBLIC_KEY` debe estar disponible en Vercel y también en la función de Supabase. La clave privada VAPID y `REMINDER_SCHEDULER_SECRET` deben configurarse solo como secretos de Supabase. Desplegá `supabase/functions/send-reminder-notifications` y programá una llamada `POST` autenticada con ese secreto; la función evita duplicados y desactiva suscripciones vencidas.
