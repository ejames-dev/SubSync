# SubSync

SubSync helps you track every active subscription across streaming and media platforms. It surfaces renewal/expiry reminders, highlights overlapping plans, and lays the groundwork for real-time price comparisons between similar services.

## Repository layout
```
projects/subscription-tracker
├── apps
│   ├── api          # NestJS 10 REST API (service catalog, subscriptions, ingest stubs)
│   └── web          # Next.js 14 App Router client (dashboard, connect, settings)
├── packages
│   └── types        # Shared TypeScript interfaces (ServiceProvider, Subscription, etc.)
└── docs             # Strategy + architecture notes captured earlier
```

## Getting started
```bash
npm install --workspaces       # installs all workspaces and links shared types
npm run dev:api                # starts NestJS API on http://localhost:3001/api
npm run dev:web                # starts Next.js client on http://localhost:3000
```

### Database (Postgres + Prisma)
1. Copy the sample env and adjust credentials as needed:
   ```bash
   cp .env.example .env
   ```
2. Start Postgres via Docker (requires Docker Desktop running):
   ```bash
   docker compose up -d
   ```
3. Apply migrations + generate the Prisma client:
   ```bash
   npm run prisma:migrate --workspace api
   npm run prisma:generate --workspace api
   ```
4. Seed the service catalog:
   ```bash
   npm run prisma:seed --workspace api
   ```
5. Launch the API with `npm run dev:api` (it now requires a reachable `DATABASE_URL`).

### Web client environment
1. `cd apps/web`
2. `cp .env.example .env` and ensure `NEXT_PUBLIC_API_URL` points at the API base URL (default `http://localhost:3001/api`).
3. Run `npm run dev:web` from the repo root to load the dashboard against live data.

The API exposes seed endpoints:
- `GET /api/services` – streaming catalog
- `GET /api/subscriptions` (plus CRUD) – in-memory subscription store
- `POST /api/integrations/:provider/connect` – stub handshake
- `POST /api/ingest/email` – placeholder email webhook

The web client currently reflects mock data for dashboard KPIs, connection cards, and settings forms.

## Scripts
| Command | Description |
| --- | --- |
| `npm run dev:api` | Watch-mode Nest server |
| `npm run dev:web` | Next.js dev server |
| `npm run lint` | Lints every workspace |
| `npm run test` | Runs workspace test placeholders |
| `npm run format` | Prettier across workspaces |
| `npm run build --workspace <name>` | Build a specific workspace (e.g., types, api, web) |
| `npm run prisma:migrate --workspace api` | Apply Prisma migrations (requires DATABASE_URL) |
| `npm run prisma:seed --workspace api` | Seed Postgres with streaming services |

## Documentation
High-level architecture, data model, and wireframes live under [`docs/`](docs/):
- `data-model-and-integrations.md`
- `wireframes.md`
- `architecture.md`

Use those references for future backend integrations (OAuth/email ingestion) and UI expansion.
