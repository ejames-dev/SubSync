# SubSync

**A local-first subscription command center for streaming, music, gaming, and media services.**

SubSync helps you track plans, billing cadence, renewal dates, and monthly spend in one place — without cloud accounts or third-party data hosting. Everything runs on your machine: a NestJS API, a Next.js dashboard, and a SQLite database bundled inside a Windows portable desktop app.

**Current version:** 1.1.0 · **Platform:** Windows portable (macOS/Linux planned)

---

## Why SubSync?

Most subscription trackers assume a hosted backend. SubSync is built for people who want full control of their data:

- **Local-only storage** — subscriptions, settings, and import history stay in a SQLite file on your device
- **No login required** — single-user desktop workflow with no external auth dependency
- **Automatic imports** — connect Gmail to pull billing emails, or paste/import receipts manually
- **Renewal awareness** — dashboard KPIs, upcoming renewals, and OS notification reminders

---

## Features

### Dashboard
- Monthly equivalent spend and spend-by-category breakdown
- Upcoming renewals list sorted by date
- Active subscription count and duplicate-plan detection
- Inline add/delete and quick navigation to subscription details

### Subscription management
- Full CRUD for subscriptions (plan, amount, currency, interval, renewal date, payment method)
- `SubscriptionEvent` audit log per subscription (created, status changed, renewal)
- Pre-seeded catalog for Spotify, YouTube Premium, Netflix, Disney+, and Hulu

### Import & connections
- **Gmail OAuth** — read-only access to scan billing and subscription emails automatically
- **Manual email import** — paste billing email content to create or update subscriptions via heuristic parsing
- **Provider connect** — persist connection state for OAuth-capable and email-based providers
- Scheduled Gmail sync every 6 hours when connected

### Renewal reminders
- Configurable lead time (days before renewal)
- **Desktop / browser push notifications** delivered through the Electron shell or web client
- Hourly background worker queues reminders for active and trial subscriptions
- Unified notification preferences in Settings (shared by the UI and reminder worker)

### Desktop app
- Single portable `.exe` — no installer required
- Bundles API (`127.0.0.1:43100`) and web UI (`127.0.0.1:43101`)
- Applies SQLite migrations automatically on first launch
- Native OS notification polling while the app is running

---

## Quick start (desktop)

1. Download the latest `SubSync *.exe` from [GitHub Releases](https://github.com/ejames-dev/SubSync/releases).
2. Double-click to launch. Windows SmartScreen may warn because the build is unsigned — see [docs/windows-portable-quickstart.md](docs/windows-portable-quickstart.md).
3. Open **Dashboard** to review spend and renewals.
4. Open **Connections** to link Gmail or import billing emails.
5. Open **Settings** to set reminder lead time and enable desktop notifications.

---

## Developer setup

### Prerequisites
- Node.js 20+
- npm 10+

### Install and run

```bash
git clone https://github.com/ejames-dev/SubSync.git
cd SubSync
npm install --workspaces
```

Copy environment variables and initialize the database:

```bash
cp .env.example .env
npm run prisma:migrate --workspace api
npm run prisma:generate --workspace api
npm run prisma:seed --workspace api
```

Start the API and web UI (in separate terminals):

```bash
npm run dev:api    # http://127.0.0.1:43100/api
npm run dev:web    # http://127.0.0.1:43101
```

Or launch the full Electron shell:

```bash
npm run build:desktop
npm run dev:desktop
```

### Gmail OAuth (optional, for billing import)

Gmail integration requires Google Cloud OAuth credentials. Configure:

```env
GOOGLE_OAUTH_CLIENT_ID="your-client-id"
GOOGLE_OAUTH_CLIENT_SECRET="your-client-secret"
GOOGLE_OAUTH_REDIRECT_URI="http://127.0.0.1:43100/api/gmail/callback"
```

Authorized redirect URI in Google Console must match `GOOGLE_OAUTH_REDIRECT_URI`.

---

## Project structure

```
SubSync/
├── apps/
│   ├── api/          # NestJS 10 REST API (Prisma + SQLite)
│   └── web/          # Next.js 14 App Router UI
├── desktop/
│   ├── main.cjs      # Electron entry — starts API, web, notifications
│   └── prepare-dist.mjs
├── packages/
│   └── types/        # Shared TypeScript contracts (@subscription-tracker/types)
└── docs/             # Architecture, roadmap, release notes
```

---

## API overview

All routes are prefixed with `/api`.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/services` | Streaming service catalog |
| `GET` | `/subscriptions` | List subscriptions |
| `POST` | `/subscriptions` | Create subscription |
| `PATCH` | `/subscriptions/:id` | Update subscription |
| `DELETE` | `/subscriptions/:id` | Delete subscription |
| `GET` | `/subscriptions/:id/events` | Subscription event timeline |
| `GET` | `/subscriptions/events/recent` | Recent status changes |
| `GET` | `/dashboard/summary` | Dashboard KPIs and breakdowns |
| `GET` | `/integrations` | List provider connections |
| `POST` | `/integrations/:provider/connect` | Connect or save a provider |
| `POST` | `/ingest/email` | Import subscription from billing email content |
| `GET` | `/settings` | Reminder preferences and email alias |
| `PUT` | `/settings` | Update reminder preferences |
| `GET` | `/notifications/preferences` | Notification preferences (unified with settings) |
| `PUT` | `/notifications/preferences` | Update notification preferences |
| `GET` | `/notifications/pending` | Undelivered push notifications |
| `POST` | `/notifications/:id/ack` | Mark notification as delivered |
| `GET` | `/gmail/status` | Gmail connection status *(v1.1)* |
| `GET` | `/gmail/auth-url` | Start Gmail OAuth *(v1.1)* |
| `GET` | `/gmail/callback` | Gmail OAuth redirect handler *(v1.1)* |
| `POST` | `/gmail/sync` | Sync billing emails from Gmail *(v1.1)* |
| `POST` | `/gmail/disconnect` | Disconnect Gmail *(v1.1)* |

---

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | SQLite database path |
| `API_PORT` | `43100` | NestJS API port |
| `CORS_ORIGIN` | `http://127.0.0.1:43101` | Allowed web UI origin(s) |
| `NEXT_PUBLIC_API_BASE_URL` | `http://127.0.0.1:43100/api` | API base URL for the web client |
| `GOOGLE_OAUTH_CLIENT_ID` | — | Gmail OAuth client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | — | Gmail OAuth client secret |
| `OAUTH_TOKEN_ENCRYPTION_KEY` | derived | Base64 32-byte key for token encryption |

See [.env.example](.env.example) for the full list.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev:api` | NestJS API in watch mode on port 43100 |
| `npm run dev:web` | Next.js dev server on port 43101 |
| `npm run dev:desktop` | Launch Electron shell |
| `npm run build` | Build types, API, and web |
| `npm run build:desktop` | Build and stage Electron runtime |
| `npm run dist:desktop` | Produce Windows portable `.exe` in `release/` |
| `npm run test` | Run workspace tests |
| `npm run lint` | Lint all workspaces |
| `npm run format` | Prettier across workspaces |
| `npm run prisma:migrate --workspace api` | Apply SQLite migrations |
| `npm run prisma:seed --workspace api` | Seed service catalog |

---

## Building the Windows portable

```bash
npm run dist:desktop
```

Output:

```text
release/SubSync 1.1.0.exe
```

Release checklist: [docs/release-checklist.md](docs/release-checklist.md)

---

## Documentation

| Doc | Contents |
| --- | --- |
| [docs/release-roadmap.md](docs/release-roadmap.md) | v1.1+ feature plan |
| [docs/architecture.md](docs/architecture.md) | System design and long-term vision |
| [docs/data-model-and-integrations.md](docs/data-model-and-integrations.md) | Schema and provider integration notes |
| [docs/wireframes.md](docs/wireframes.md) | UI wireframes |
| [docs/windows-portable-quickstart.md](docs/windows-portable-quickstart.md) | End-user desktop guide |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Desktop | Electron 41, electron-builder |
| API | NestJS 10, Prisma 5, SQLite |
| Web | Next.js 14, React 18, Tailwind CSS |
| Shared types | TypeScript monorepo package |
| Scheduling | `@nestjs/schedule` (reminders, Gmail sync) |

`docker-compose.yml` is legacy (Postgres) and is not required for local development.

---

## Roadmap (v1.1+)

- Auto-update via `electron-updater`
- CSV / JSON export and SQLite backup/restore
- macOS and Linux desktop builds
- Richer dashboard grid, service logos, multi-currency display
- Expanded provider catalog and stronger email parsing

Full plan: [docs/release-roadmap.md](docs/release-roadmap.md)

---

## Known limitations

- Windows portable only today; unsigned executable may trigger SmartScreen
- Per-provider Spotify/YouTube OAuth is simulated — Gmail is the first real OAuth integration
- Email-channel reminders are logged but not sent (no SMTP); push/desktop notifications are the working path
- No cloud sync or multi-user support

---

## Author

Evan Newman · [GitHub](https://github.com/ejames-dev/SubSync)
