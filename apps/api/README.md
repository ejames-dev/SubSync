# SubSync API

NestJS REST API for SubSync. In normal development, run it from the repo root so workspace scripts and root devDependencies are available.

## Local development

```bash
cd ../..
npm install
cp .env.example .env
cp .env apps/api/.env
npm run prisma:migrate --workspace api
npm run prisma:generate --workspace api
npm run prisma:seed --workspace api
npm run dev:api
```

The root `dev:api` script starts the API on `http://127.0.0.1:43100/api`.

## Database

The development database is SQLite. With `DATABASE_URL="file:./dev.db"`, Prisma resolves the file relative to `apps/api/prisma/schema.prisma`, so the database lives at `apps/api/prisma/dev.db`.

Migrations are applied by `apps/api/scripts/init-sqlite.mjs`, which uses the same shared migration runner as the desktop app and records applied migrations in `_migrations`.

## Useful commands

```bash
npm run test --workspace api
npm run test:e2e --workspace api
npm run build --workspace api
npm run prisma:migrate --workspace api
npm run prisma:generate --workspace api
```
