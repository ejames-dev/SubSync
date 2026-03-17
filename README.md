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

## Desktop app
SubSync now has an Electron desktop target for Windows packaging.

```bash
npm run build:desktop          # builds API + web and prepares the desktop runtime
npm run dev:desktop            # launches the Electron shell locally
npm run dist:desktop           # creates a Windows portable executable in release/
```

The portable Windows build is written to:

```text
release/SubSync 1.0.0.exe
```

`npm run dist:desktop` now stages a dedicated Electron app directory under `desktop/app/`, installs only the runtime dependencies needed for packaging, and applies all bundled SQLite migrations on first launch.

For GitHub distribution, see:
- `docs/windows-portable-quickstart.md`
- `docs/release-checklist.md`

The desktop runtime starts:
- the Nest API locally on `http://127.0.0.1:43100/api`
- the Next.js frontend locally on `http://127.0.0.1:43101`
- a local SQLite database under the app user-data directory

### Database (SQLite + Prisma)
1. Copy the sample env and adjust credentials as needed:
   ```bash
   cp .env.example .env
   ```
2. Apply migrations + generate the Prisma client:
   ```bash
   npm run prisma:migrate --workspace api
   npm run prisma:generate --workspace api
   ```
3. Seed the service catalog:
   ```bash
   npm run prisma:seed --workspace api
   ```
4. Launch the API with `npm run dev:api`.

### Web client environment
1. `cd apps/web`
2. `cp .env.example .env` and ensure `NEXT_PUBLIC_API_URL` points at the API base URL (default `http://localhost:3001/api`).
3. Run `npm run dev:web` from the repo root to load the dashboard against live data.

The API exposes seed endpoints:
- `GET /api/services` – streaming catalog
- `GET /api/subscriptions` (plus CRUD) – SQLite-backed subscription store
- `GET /api/dashboard/summary` – computed dashboard metrics from local data
- `GET /api/integrations` / `POST /api/integrations/:provider/connect` – locally persisted provider connection state
- `POST /api/ingest/email` – billing email import that creates or updates local subscriptions

The desktop client now persists subscriptions, connection state, and settings locally through the packaged API. OAuth provider links are still simulated local connections rather than real third-party auth flows, but email import and dashboard calculations are backed by SQLite.

`docker-compose.yml` is legacy and is not required for local development anymore.

## Scripts
| Command | Description |
| --- | --- |
| `npm run dev:api` | Watch-mode Nest server |
| `npm run dev:web` | Next.js dev server |
| `npm run dev:desktop` | Launch the Electron desktop shell |
| `npm run lint` | Lints every workspace |
| `npm run test` | Runs workspace test placeholders |
| `npm run format` | Prettier across workspaces |
| `npm run build --workspace <name>` | Build a specific workspace (e.g., types, api, web) |
| `npm run build:desktop` | Build API/web and stage the Electron runtime |
| `npm run dist:desktop` | Build the Windows portable `.exe` |
| `npm run prisma:migrate --workspace api` | Apply Prisma migrations to the local SQLite database |
| `npm run prisma:seed --workspace api` | Seed SQLite with streaming services |

## Documentation
High-level architecture, data model, and wireframes live under [`docs/`](docs/):
- `data-model-and-integrations.md`
- `wireframes.md`
- `architecture.md`

Use those references for future backend integrations (OAuth/email ingestion) and UI expansion.
