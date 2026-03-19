# SubSync Wiki

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Repository Layout](#repository-layout)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Development](#local-development)
  - [Desktop Application](#desktop-application)
- [Data Model](#data-model)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Roadmap](#roadmap)

---

## Overview

**SubSync** is a desktop-packaged subscription tracker that keeps every streaming, productivity, and media subscription in one command center. It ingests a structured service catalog, lets you create or edit subscriptions by hand, and tracks each plan's status, billing cadence, and renewal history. The dashboard highlights monthly spend, near-term renewals, and recent status changes so you never lose track of what you're paying for.

SubSync ships as a self-contained Windows portable executable — no Docker, Postgres, or Node.js installation required. Under the hood it bundles a NestJS REST API, a Next.js web front-end, and an SQLite database that persists all data locally on your machine.

---

## Key Features

| Feature | Description |
| --- | --- |
| **Subscription Lifecycle Management** | Create, edit, and delete subscriptions with full event history. Every status change is logged via `SubscriptionEvent` records for auditing and timeline display. |
| **Renewal Awareness** | Upcoming-renewals stack with snooze/review actions. Configurable reminder preferences (lead-time days and notification channels) power the built-in reminder scheduler. |
| **Dashboard & Analytics** | KPI strip showing monthly spend, active subscription count, and upcoming renewals. Spend-by-category breakdowns and duplicate-plan detection help you spot waste. |
| **Filterable Subscription Grid** | Search by name, filter by status, and sort subscriptions. URL-synced filters make views shareable and refresh-safe. |
| **In-line Context** | Service logos, note snippets, status badges, and a timeline component provide at-a-glance context when drilling into any subscription. |
| **Email Billing Import** | Post a billing email to `/api/ingest/email` to automatically create or update subscriptions based on extracted fields. |
| **Provider Connection State** | Save connection metadata for streaming providers. OAuth placeholders are ready for future real third-party auth flows. |
| **Local Data Persistence** | All data lives in a local SQLite database. No cloud account or external database required. |
| **Portable Desktop App** | Single Windows `.exe` with embedded API and web UI — just download and run. |

---

## Technology Stack

| Layer | Technology | Version |
| --- | --- | --- |
| **API** | NestJS | 10.x |
| **ORM / Database** | Prisma 5 + SQLite | 5.20.0 |
| **Web Front-end** | Next.js (App Router) | 14.x |
| **Styling** | Tailwind CSS | 3.3.0 |
| **UI Primitives** | Radix UI | — |
| **Icons** | Lucide React | 0.474.0 |
| **Desktop Shell** | Electron | 41.0.2 |
| **Desktop Packaging** | electron-builder | 26.8.1 |
| **Language** | TypeScript | 5.x |
| **Package Manager** | npm workspaces | 10.8.1 |

---

## Architecture

```
          ┌────────────┐        ┌────────────────┐
User → UI │  Next.js   ├──API──▶│ NestJS REST    │
          │  (web)     │        │ Gateway        │
          └────────────┘        └───────┬────────┘
                                        │
      Email receipts ──────────▶ Ingest Module
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │   SQLite      │
                                 │  (Prisma 5)   │
                                 └──────────────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │  Reminder     │→ Email / Push
                                 │  Scheduler    │   (future)
                                 └──────────────┘
```

### API Modules

The NestJS API is organized into feature modules:

| Module | Responsibility |
| --- | --- |
| **PrismaModule** | Database abstraction layer wrapping the Prisma client |
| **ServiceCatalogModule** | Pre-seeded catalog of streaming/media providers (Netflix, Spotify, etc.) |
| **SubscriptionsModule** | CRUD for user subscriptions plus `SubscriptionEvent` logging |
| **IntegrationsModule** | Connection state for OAuth and email-based providers |
| **IngestModule** | Email billing import endpoint |
| **DashboardModule** | Computes KPIs: monthly spend, renewal count, duplicates, spend-by-category |
| **NotificationPreferencesModule** | Stores user reminder preferences (lead time, channels) |
| **ReminderModule** | Scheduled job (`@nestjs/schedule`) that checks for upcoming renewals |
| **SettingsModule** | General user-level configuration |

### Web Components

| Component | Purpose |
| --- | --- |
| `DashboardClient` | KPI strip, spend-by-category, upcoming renewals, status-change feed |
| `SubscriptionsGrid` | Filterable, searchable subscription list |
| `SubscriptionForm` | Create and edit subscription form |
| `SubscriptionTimeline` | Per-subscription event history timeline |
| `ConnectClient` | Provider OAuth placeholder and email import UI |
| `SettingsClient` | Notification preference form |
| `StatusBadge` | Visual subscription status indicator |
| `SiteShell` | Top-level navigation shell |

### Shared Types

The `@subscription-tracker/types` package keeps TypeScript interfaces consistent across the monorepo. Key types include `Subscription`, `SubscriptionStatus`, `SubscriptionEvent`, `ServiceProvider`, `DashboardSpendByCategory`, `DashboardDuplicateGroup`, `IntegrationConnection`, `NotificationPreference`, `UserSettings`, and `EmailIngestResult`.

---

## Repository Layout

```
SubSync/
├── apps/
│   ├── api/                    # NestJS 10 REST API
│   │   ├── src/
│   │   │   ├── subscriptions/  # Subscription CRUD + event logging
│   │   │   ├── dashboard/      # Dashboard metrics service
│   │   │   ├── service-catalog/ # Provider catalog
│   │   │   ├── integrations/   # OAuth/email connection state
│   │   │   ├── ingest/         # Email billing import
│   │   │   ├── notifications/  # Notification preferences
│   │   │   ├── reminders/      # Renewal reminder scheduling
│   │   │   ├── settings/       # User settings
│   │   │   ├── prisma/         # Prisma service
│   │   │   └── common/         # Logging interceptor
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Data model
│   │   │   ├── seed.ts         # Service catalog seed data
│   │   │   └── migrations/     # SQLite migrations
│   │   └── test/               # E2E tests (Jest + supertest)
│   │
│   └── web/                    # Next.js 14 App Router front-end
│       └── src/
│           ├── app/            # Pages (dashboard, subscriptions, connect, settings)
│           ├── components/     # React components
│           └── lib/            # Utility / fetch helpers
│
├── packages/
│   └── types/                  # Shared TypeScript interfaces
│
├── desktop/
│   ├── main.cjs                # Electron main process
│   └── prepare-dist.mjs        # Desktop build staging script
│
├── docs/                       # Architecture, data model, wireframes, release notes
├── docker-compose.yml          # Legacy (not required for local dev)
├── .env.example                # Root environment template
└── package.json                # Monorepo workspace configuration
```

---

## Getting Started

### Prerequisites

- **Node.js** 18 or later
- **npm** 10 or later

### Local Development

1. **Install dependencies** (all workspaces are linked automatically):

   ```bash
   npm install --workspaces
   ```

2. **Set up the database**:

   ```bash
   cp .env.example .env
   npm run prisma:migrate --workspace api
   npm run prisma:generate --workspace api
   npm run prisma:seed --workspace api
   ```

3. **Start the API** (watch mode — default port `3000`, or set `API_PORT`):

   ```bash
   npm run dev:api
   ```

4. **Start the web client** (in a second terminal, on `http://localhost:3000`):

   ```bash
   npm run dev:web
   ```

### Desktop Application

Build and run the Electron desktop shell:

```bash
# Build API + web and stage the desktop runtime
npm run build:desktop

# Launch the Electron shell locally
npm run dev:desktop

# Create the Windows portable executable (outputs to release/)
npm run dist:desktop
```

The resulting `SubSync 1.0.0.exe` is a self-contained portable executable:

- Embeds the NestJS API and Next.js web client
- Uses a local SQLite database at `%APPDATA%\SubSync\data\subsync.db`
- Runs the API on port **43100** and the web UI on port **43101** (internal)
- Automatically applies database migrations on first launch
- Requires no Docker, Postgres, or Node.js on the target machine

---

## Data Model

SubSync uses Prisma 5 with SQLite. The schema defines the following core tables:

| Table | Description |
| --- | --- |
| `Service` | Pre-seeded catalog of streaming/media providers (name, slug, category, logo URL, OAuth support flag) |
| `Subscription` | A user's subscription record — service reference, plan name, status, billing amount/interval, next renewal date, notes |
| `SubscriptionEvent` | Audit trail for every subscription change (`created`, `status_changed`, `renewed`, etc.) |
| `IntegrationConnection` | Provider connection state: provider key, status, connected/synced timestamps |
| `UserSettings` | Lead-time days and notification channel preferences |
| `NotificationPreference` | Per-user reminder configuration |

### Subscription Status Values

- `active` — currently billed and in use
- `trial` — free trial period
- `canceled_pending` — canceled but still active until the current billing period ends
- `canceled` — fully canceled
- `paused` — temporarily suspended

### Billing Intervals

- `monthly`
- `yearly`

---

## API Reference

The NestJS API exposes the following REST endpoints (all prefixed with `/api`):

### Service Catalog

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/services` | List all services in the catalog |

### Subscriptions

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/subscriptions` | List all subscriptions (supports `?status=` and `?search=` query params) |
| `GET` | `/subscriptions/:id` | Get a single subscription with its event timeline |
| `POST` | `/subscriptions` | Create a new subscription |
| `PATCH` | `/subscriptions/:id` | Update a subscription |
| `DELETE` | `/subscriptions/:id` | Delete a subscription and its events |

### Dashboard

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/dashboard/summary` | KPI summary: monthly spend, active count, upcoming renewals, spend by category, duplicates, recent events |

### Integrations

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/integrations` | List all provider connection states |
| `POST` | `/integrations/:provider/connect` | Save connection state for a provider |
| `POST` | `/integrations/:provider/disconnect` | Remove connection state for a provider |

### Email Ingestion

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/ingest/email` | Import a billing email to create or update subscriptions |

### Notification Preferences

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/notifications/preferences` | Get current notification preferences |
| `PUT` | `/notifications/preferences` | Update notification preferences |

### Settings

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/settings` | Get user settings |
| `PUT` | `/settings` | Update user settings |

---

## Configuration

### Environment Variables

#### Root `.env`

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | SQLite database file path (Prisma connection string) |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origins (comma-separated for multiple) |
| `API_PORT` | `3000` | Port the NestJS API listens on in development |

#### Web Client (`apps/web/.env`)

| Variable | Default | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api` | API base URL for the web client (adjust to match your `API_PORT`) |

> **Note:** In local development the API listens on the port set by `API_PORT` (default `3000`). The desktop Electron build uses hardcoded port `43100`. Make sure `NEXT_PUBLIC_API_URL` matches the port your API is actually running on.

#### Desktop (Electron)

The desktop app uses hardcoded defaults — no `.env` file is needed:

- API port: `43100`
- Web port: `43101`
- SQLite path: `<app-user-data>/data/subsync.db`

---

## Testing

### Running Tests

```bash
# Run all workspace tests
npm run test

# API end-to-end tests only
npm run test:e2e --workspace api

# API test coverage report
npm run test:cov --workspace api
```

### Test Coverage

- **API E2E tests** (`apps/api/test/app.e2e-spec.ts`): Comprehensive suite covering subscription CRUD, dashboard endpoints, integrations, and email ingestion — uses Jest with supertest and mocked Prisma.
- **API unit tests** (`apps/api/src/subscriptions/subscriptions.service.spec.ts`): Service-level unit tests.
- **Web & Types**: Placeholder test scripts (pass with exit code 0).

### Linting & Formatting

```bash
npm run lint       # ESLint across all workspaces
npm run format     # Prettier across all workspaces
```

---

## Troubleshooting

### Port Already in Use

If SubSync reports that a port is already in use, close the process occupying port `43100` or `43101` and relaunch.

### Windows SmartScreen Warning

The portable `.exe` is unsigned. Windows SmartScreen may show a warning on first launch. Click **More info** → **Run anyway** to proceed.

### App Window Stays on Startup Screen

Close the window and relaunch `SubSync 1.0.0.exe`. If the issue persists, check that no other SubSync process is running in the background.

### Clean Reset

To start fresh, delete the SubSync data folder from your Windows user application data area (`%APPDATA%\SubSync`) and relaunch the application. This removes all saved subscriptions, connection states, and settings.

### Database Migration Errors

If migrations fail during development:

```bash
# Reset the database and re-apply all migrations
rm apps/api/prisma/dev.db
npm run prisma:migrate --workspace api
npm run prisma:seed --workspace api
```

---

## FAQ

**Q: Does SubSync require an internet connection?**
A: No. SubSync runs entirely on your local machine with a local SQLite database. An internet connection is only needed to download the application.

**Q: Does SubSync sync with real streaming provider accounts?**
A: In v1.0.0, provider "Connect" actions save local connection state only. Real OAuth sync with third-party providers is planned for a future release. Email billing import is the primary automated ingestion path.

**Q: Where is my data stored?**
A: All data is stored in a local SQLite database. On Windows, the database file is located at `%APPDATA%\SubSync\data\subsync.db`. In development mode, it is stored at `apps/api/prisma/dev.db`.

**Q: Can I run SubSync on macOS or Linux?**
A: The v1.0.0 desktop build targets Windows only. For development, the web and API run on any platform with Node.js 18+.

**Q: How do I back up my data?**
A: Copy the SQLite database file (`subsync.db`) from your application data directory to a safe location. To restore, replace the file and relaunch SubSync.

**Q: How does email billing import work?**
A: Send a POST request to `/api/ingest/email` with the billing email content. The ingest module parses the email to extract the provider, amount, and renewal date, then creates or updates the matching subscription.

---

## Roadmap

The following features are under consideration for future releases:

- **Live OAuth integrations** — Real Spotify, Google/YouTube, and Apple provider sync
- **Multi-currency normalization** — Automatic currency conversion for global users
- **Duplicate detection improvements** — Smarter matching for the same service via multiple providers
- **Spend forecasting & budgeting** — Projected costs and budget caps with alerts
- **Shared households** — Invite family members to a shared subscription view
- **macOS and Linux desktop builds** — Cross-platform Electron packaging
- **Push notifications** — Browser and mobile push via Expo/Web Push
- **Advanced email parsing** — ML-enhanced receipt classification and field extraction

---

## Available Scripts

| Command | Description |
| --- | --- |
| `npm install --workspaces` | Install and link all workspaces |
| `npm run dev:api` | Start NestJS API in watch mode |
| `npm run dev:web` | Start Next.js dev server |
| `npm run dev:desktop` | Launch Electron shell locally |
| `npm run build:desktop` | Build API + web and stage the desktop runtime |
| `npm run dist:desktop` | Create the Windows portable `.exe` |
| `npm run lint` | ESLint across all workspaces |
| `npm run test` | Run all workspace tests |
| `npm run format` | Prettier across all workspaces |
| `npm run prisma:migrate --workspace api` | Apply SQLite migrations |
| `npm run prisma:generate --workspace api` | Generate Prisma client |
| `npm run prisma:seed --workspace api` | Seed the service catalog |

---

## Further Reading

- [Architecture](architecture.md) — System design, ingestion pipeline, and infrastructure
- [Data Model & Integrations](data-model-and-integrations.md) — Entity relationships and provider integration details
- [Wireframes](wireframes.md) — UI mockups
- [Release Notes v1.0.0](release-notes-v1.0.0.md) — Feature list and known limitations
- [Windows Portable Quickstart](windows-portable-quickstart.md) — End-user guide for the desktop app
- [Release Checklist](release-checklist.md) — QA validation steps
