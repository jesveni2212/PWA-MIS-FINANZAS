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

La aplicación cubre la primera versión funcional de finanzas personales, grupos compartidos, invitaciones seguras, perfiles con avatar y experiencia PWA. Las integraciones OAuth, notificaciones y funciones financieras avanzadas pueden incorporarse en etapas posteriores.
