# SubSync

SubSync keeps every streaming, productivity, and media subscription in one command center. It ingests a structured service catalog, lets you create or edit subscriptions by hand, and tracks each plan’s status, billing cadence, and renewal history. The dashboard highlights monthly spend, near-term renewals, and recent status changes, while the active-subscriptions grid supports search + status filters so you can zero in on exactly what needs attention.

### Highlights
- **End-to-end subscription lifecycle:** manual creation flow, edit/delete, and Prisma-backed `SubscriptionEvent` logging for every status change.
- **Renewal awareness:** upcoming-renewals stack with snooze/review actions, plus reminder preferences (lead time + channels) ready for the notification worker.
- **Context in-line:** service logos, note snippets, status badges, and a timeline component when you drill into an individual subscription.
- **Modern dashboard UX:** KPI strip, status-change feed, filterable grid, and URL-synced filters/search so views are shareable and refresh-safe.

### Stack
- **API:** NestJS 10 + Prisma 5 on Postgres (Dockerized), with modular controllers for subscriptions, service catalog, integrations, ingest, and notifications.
- **Web:** Next.js 14 App Router + Tailwind UI components, speaking to the API via typed fetch helpers.
- **Shared types:** `@subscription-tracker/types` package keeps DTOs/models consistent across the monorepo.

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
