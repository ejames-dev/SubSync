# SubSync

[![CI](https://github.com/ejames-dev/SubSync/actions/workflows/ci.yml/badge.svg)](https://github.com/ejames-dev/SubSync/actions/workflows/ci.yml)

**A local-first subscription command center for streaming, music, gaming, and media services.**

SubSync helps you track plans, billing cadence, renewal dates, and monthly spend in one place — without cloud accounts or third-party data hosting. Everything runs on your machine: a NestJS API, a Next.js dashboard, and a SQLite database bundled inside a desktop app.

**Current version:** 1.1.2 · **Platforms:** Windows portable · macOS Apple Silicon · Linux AppImage

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
- Upcoming renewals list sorted by date, with per-subscription snooze
- Active subscription count and duplicate-plan detection
- Recent activity feed of subscription status changes
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

### Data & backup
- CSV / JSON export of subscriptions (`/api/data/export/subscriptions`)
- One-click SQLite backup and restore from Settings

### Desktop app
- Windows portable `.exe`, macOS `.dmg` / `.zip` for Apple Silicon, and Linux AppImage
- Unsigned today; Windows SmartScreen may warn and macOS requires right-click Open until SubSync is signed
- In-app auto-update from GitHub Releases (`electron-updater`) on Windows and Linux; macOS updates are disabled until signing
- Bundles API (`127.0.0.1:43100`) and packaged web UI (`127.0.0.1:43101`)
- Applies SQLite migrations automatically on first launch (tracked in a `_migrations` ledger)
- Native OS notification polling while the app is running

---

## Quick start (desktop)

1. Download the latest build for your platform from [GitHub Releases](https://github.com/ejames-dev/SubSync/releases): `SubSync *.exe` for Windows, `SubSync *-arm64.dmg` for macOS Apple Silicon, or `SubSync-*.AppImage` for Linux.
2. Launch it. Windows users should read [docs/windows-portable-quickstart.md](docs/windows-portable-quickstart.md); macOS and Linux users should read [docs/macos-linux-desktop-quickstart.md](docs/macos-linux-desktop-quickstart.md).
3. Open **Dashboard** to review spend and renewals.
4. Open **Connections** to link Gmail or import billing emails.
5. Open **Settings** to set reminder lead time and enable desktop notifications.

---

## Developer setup

### Prerequisites
- Node.js 22+ (the desktop migration tests use the built-in `node:sqlite` module)
- npm 10+

### Install and run

```bash
git clone https://github.com/ejames-dev/SubSync.git
cd SubSync
npm install
```

Copy environment variables and initialize the database:

```bash
cp .env.example .env
cp .env apps/api/.env
npm run prisma:migrate --workspace api
npm run prisma:generate --workspace api
npm run prisma:seed --workspace api
```

Start the API and web UI (in separate terminals):

```bash
npm run dev:api    # http://127.0.0.1:43100/api
npm run dev:web    # http://127.0.0.1:3000
```

Open `http://127.0.0.1:3000/dashboard` for local web development. The packaged desktop app still uses `127.0.0.1:43101` for its bundled web server.

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
| `POST` | `/subscriptions/:id/snooze` | Snooze an upcoming renewal |
| `GET` | `/subscriptions/:id/events` | Subscription event timeline |
| `GET` | `/subscriptions/events/recent` | Recent status changes |
| `GET` | `/dashboard/summary` | Dashboard KPIs and breakdowns |
| `GET` | `/integrations` | List provider connections |
| `POST` | `/integrations/:provider/connect` | Connect or save a provider |
| `DELETE` | `/integrations/:provider` | Disconnect a provider |
| `POST` | `/ingest/email` | Import subscription from billing email content |
| `GET` | `/data/export/subscriptions` | Export subscriptions (`?format=json\|csv`) |
| `GET` | `/data/backups` | List SQLite backups |
| `POST` | `/data/backup` | Create a SQLite backup |
| `GET` | `/data/backup/:fileName` | Download a backup file |
| `POST` | `/data/restore` | Restore from an uploaded backup |
| `POST` | `/data/restore/:fileName` | Restore from an existing backup |
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
| `CORS_ORIGIN` | `http://localhost:3000,http://127.0.0.1:3000` | Allowed local web UI origin(s) |
| `NEXT_PUBLIC_API_BASE_URL` | `http://127.0.0.1:43100/api` | API base URL for the web client |
| `GOOGLE_OAUTH_CLIENT_ID` | — | Gmail OAuth client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | — | Gmail OAuth client secret |
| `GMAIL_OAUTH_RETURN_URL` | `http://127.0.0.1:3000/connect` | Web URL used after Gmail OAuth in local development |
| `OAUTH_TOKEN_ENCRYPTION_KEY` | derived | Base64 32-byte key for token encryption |

See [.env.example](.env.example) for the full list.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev:api` | NestJS API in watch mode on port 43100 |
| `npm run dev:web` | Next.js dev server on port 3000 |
| `npm run dev:desktop` | Launch Electron shell |
| `npm run build` | Build types, API, and web |
| `npm run build:desktop` | Build and stage Electron runtime |
| `npm run dist:desktop` | Package the current platform's desktop build into `release/` |
| `npm run test` | Run workspace tests |
| `npm run lint` | Lint all workspaces |
| `npm run format` | Prettier across workspaces |
| `npm run prisma:migrate --workspace api` | Apply SQLite migrations |
| `npm run prisma:seed --workspace api` | Seed service catalog |

---

## Building the desktop app

```bash
npm run dist:desktop
```

Local packaging produces the current platform's artifact:

```text
release/SubSync 1.1.2.exe        # Windows portable
release/SubSync 1.1.2-arm64.dmg  # macOS Apple Silicon
release/SubSync-1.1.2.AppImage   # Linux
```

The `Release` GitHub workflow builds Windows, macOS Apple Silicon, and Linux artifacts on matching hosted runners and uploads them to a draft GitHub Release when a `v*` tag is pushed or the workflow is dispatched manually.

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
| [docs/macos-linux-desktop-quickstart.md](docs/macos-linux-desktop-quickstart.md) | macOS and Linux desktop launch notes |
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

## Roadmap (v1.2+)

- Code signing for Windows and macOS builds
- Intel or universal macOS builds
- Spend-by-category chart on the dashboard
- Expanded provider catalog and provider-specific email parsers
- Budget alerts and spend forecasting

Full plan: [docs/release-roadmap.md](docs/release-roadmap.md)

---

## Known limitations

- Builds are unsigned: Windows SmartScreen may warn, and macOS requires right-click Open on first launch
- macOS builds are Apple Silicon only and do not auto-update until signing is configured
- Per-provider Spotify/YouTube OAuth is simulated — Gmail is the first real OAuth integration
- Email-channel reminders are logged but not sent (no SMTP); push/desktop notifications are the working path
- No cloud sync or multi-user support

---

## Author

Evan Newman · [GitHub](https://github.com/ejames-dev/SubSync)
