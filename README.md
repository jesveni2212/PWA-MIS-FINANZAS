# Mis Finanzas

Base técnica de la PWA privada **Mis Finanzas**, creada con Next.js, TypeScript estricto y Tailwind CSS.

## Requisitos

- Node.js con Corepack disponible.
- pnpm 11 o superior.

## Desarrollo

```bash
corepack pnpm dev
```

La aplicación se abre en `http://localhost:3000`.

## Calidad

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm test:e2e
```

Las variables de entorno locales deben copiarse desde `.env.example`; nunca se deben confirmar secretos en el repositorio.
