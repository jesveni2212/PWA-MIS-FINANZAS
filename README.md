# Mis Finanzas

PWA privada para finanzas personales y compartidas.

## Desarrollo local

```powershell
Copy-Item .env.example .env.local
corepack pnpm dev
```

Abre `http://localhost:3000` y consulta `http://localhost:3000/api/health`.

## Verificación

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm test:e2e
```

## Despliegue

1. Crea un repositorio privado en GitHub y agrega el remoto.
2. Importa el repositorio en Vercel.
3. Define `NEXT_PUBLIC_APP_URL` en Vercel.
4. Conecta el dominio y configura los DNS solicitados por Vercel.
