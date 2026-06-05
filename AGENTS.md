# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

SubSync is an npm-workspaces monorepo (`apps/api`, `apps/web`, `packages/types`). Local web development requires **two processes**: NestJS API (port **43100**) and Next.js web (port **3000**). Data is stored in a **SQLite file** at `apps/api/prisma/dev.db` (not a separate database server).

### Install

```bash
npm install
```

Use plain `npm install` at the repo root (not only `npm install --workspaces`) so root devDependencies such as `cross-env` and `electron` are installed.

### Environment files

1. Copy root env: `cp .env.example .env`
2. Copy API env for Prisma CLI: `cp .env apps/api/.env`
3. Optional web env: `cp apps/web/.env.example apps/web/.env` (root `npm run dev:web` sets `NEXT_PUBLIC_API_BASE_URL` automatically)

`DATABASE_URL` is resolved relative to `apps/api/prisma/schema.prisma`, so `file:./dev.db` points at `apps/api/prisma/dev.db`.

### Database bootstrap (first-time / fresh clone)

`npm run prisma:migrate --workspace api` applies migrations in **timestamp order**, but `20260317174500_init_sqlite` must run **before** earlier-dated migrations that alter `Subscription`. On a fresh DB, apply in this order:

```bash
cd apps/api
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const order = [
  '20260317174500_init_sqlite',
  '20260312134500_notifications',
  '20260313140000_subscription_events',
  '20260317183000_user_settings',
  '20260317193000_integration_connections',
];
const db = new DatabaseSync('prisma/dev.db');
db.exec('PRAGMA foreign_keys = ON;');
for (const m of order) db.exec(readFileSync(resolve('prisma/migrations', m, 'migration.sql'), 'utf8'));
db.close();
"
DATABASE_URL="file:./dev.db" npm run prisma:generate
DATABASE_URL="file:./dev.db" npm run prisma:seed
```

### Running dev servers

**API** — `npm run dev:api` (`nest start --watch`) currently fails at runtime because compiled output under `dist/src/` cannot resolve `../../prisma/generated/client`. Until that is fixed, start the API with:

```bash
cd apps/api
DATABASE_URL="file:./dev.db" API_PORT=43100 \
  CORS_ORIGIN="http://127.0.0.1:3000,http://localhost:3000" \
  npx ts-node -r tsconfig-paths/register src/main.ts
```

**Web** — from repo root:

```bash
npm run dev:web
```

Open **http://127.0.0.1:3000/dashboard** (not only `localhost`) so the browser origin matches API CORS when `CORS_ORIGIN` includes `http://127.0.0.1:3000`.

### Standard commands (see root `package.json` / `README.md`)

| Task | Command |
|------|---------|
| Lint | `npm run lint` |
| Unit tests | `npm run test` |
| API e2e | `npm run test:e2e --workspace api` |
| Build all | `npm run build` |
| Desktop dev | `npm run build:desktop && npm run dev:desktop` |

### Gotchas

- **CORS:** Default `.env.example` only allows `http://localhost:3000`. Browsers using `127.0.0.1` need that origin in `CORS_ORIGIN` too.
- **Prisma generate:** Run after `npm install` if the API fails to load `@prisma/client` / generated client.
- **Legacy Postgres:** `docker-compose.yml` is not used; Prisma schema is SQLite-only.
