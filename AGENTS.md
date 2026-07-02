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

`npm run prisma:migrate --workspace api` runs the shared migration runner
(`desktop/migrations.cjs`): migrations apply in timestamp order, are recorded in
a `_migrations` ledger table, and re-running is a no-op — safe on fresh and
existing databases alike.

```bash
cd apps/api
DATABASE_URL="file:./dev.db" npm run prisma:migrate
DATABASE_URL="file:./dev.db" npm run prisma:generate
DATABASE_URL="file:./dev.db" npm run prisma:seed
```

### Running dev servers

**API** — `npm run dev:api` (`nest start --watch`). Ensure the env files and database are set up first (see above):

```bash
DATABASE_URL="file:./dev.db" API_PORT=43100 \
  CORS_ORIGIN="http://127.0.0.1:3000,http://localhost:3000" \
  npm run dev:api
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
