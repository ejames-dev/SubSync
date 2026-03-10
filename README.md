# Subscription Tracker (Streaming + Media MVP)

Beacon is a unified dashboard for monitoring streaming and media subscriptions, auto-importing renewals via OAuth connections and email parsing.

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
npm run dev:api                # starts NestJS API on http://localhost:3000/api
npm run dev:web                # starts Next.js client on http://localhost:3000 (port may vary)
```

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

## Documentation
High-level architecture, data model, and wireframes live under [`docs/`](docs/):
- `data-model-and-integrations.md`
- `wireframes.md`
- `architecture.md`

Use those references for future backend integrations (OAuth/email ingestion) and UI expansion.
