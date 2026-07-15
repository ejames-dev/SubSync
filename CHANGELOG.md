# Changelog

All notable changes to SubSync are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Money-awareness tools: configurable monthly budget alerts, a currency-safe
  three-month renewal forecast, provider cancellation links with a
  flagged-for-cancellation workflow, and an estimated yearly review of spend,
  price increases, and subscriptions that may need attention.
- macOS (Apple Silicon) and Linux (AppImage) desktop builds. `npm run
  dist:desktop` now packages the current platform's target, CI packages all
  three platforms on main, and a tag-triggered Release workflow builds and
  publishes Windows, macOS, and Linux artifacts to a draft GitHub Release.
- Linux AppImage builds auto-update through the existing Settings flow.
  Automatic updates stay disabled on macOS until builds are signed; Settings
  explains this and points to GitHub Releases.

### Changed
- `docs/release-roadmap.md` rewritten for the post-v1.1.2 state: the June 2026
  plan (largely shipped in v1.1.0–v1.1.2) is replaced with themed releases
  through v2.0.0 — v1.2.0 "Cross-platform", v1.2.x signing patches, v1.3.0
  "Smarter imports", v1.4.0 "Money awareness", and v2.0.0 "Beyond one
  machine".

## [1.1.2] - 2026-07-02

### Fixed
- Fresh installs no longer crash on first launch: SQLite migrations now apply
  in dependency order and are recorded in a `_migrations` ledger so each one
  runs exactly once. Existing databases are baselined in place with no data
  loss, which also removes the relaunch crash from re-running non-idempotent
  `ALTER TABLE` migrations.
- Email import no longer invents a $9.99 price when no billing amount can be
  parsed from the email; the import is rejected with a clear message instead.
  Manual imports surface it on the Connect page, and Gmail sync counts the
  message as failed and retries it on a later sync.
- The packaged desktop app loads the API from its post-1.1.1 build location
  (`dist/main.js`). Desktop builds made from v1.1.1 would have failed at
  startup; no such build was ever published.

### Changed
- `npm run prisma:migrate --workspace api` uses the same migration runner as
  the desktop app, so the manual migration-ordering workaround for fresh dev
  databases is no longer needed.
- `npm test` now also runs the desktop migration-runner tests
  (`npm run test:desktop`).

## [1.1.1] - 2026-06-20

### Fixed
- API now builds to `dist/` root so the Prisma client path resolves at runtime
  (`nest start` and the packaged desktop runtime no longer fail to find the
  generated client).
- Desktop packaging no longer breaks on rebuilds: the API's incremental
  `tsbuildinfo` now lives inside `dist/` so Nest's `deleteOutDir` clears it each
  build, preventing empty output and the `Missing build artifact: apps/api/dist`
  failure in `prepare-dist.mjs`.

### Changed
- `*.tsbuildinfo` build artifacts are gitignored.
- AGENTS.md drops the obsolete `ts-node` dev-server workaround.

## [1.1.0] - 2026-06-05

See [`docs/release-notes-v1.1.0.md`](docs/release-notes-v1.1.0.md) for the full notes.

### Added
- Real Gmail OAuth with read-only access for automatic billing email import.
- Gmail sync API (`POST /api/gmail/sync`) and scheduled background sync every 6 hours.
- Connect page UI for linking Gmail, manual sync, and disconnect.
- Renewal reminder delivery via OS notifications in the Electron desktop app.
- Browser notification polling for local web development when push alerts are enabled.
- Pending notification queue API (`GET /api/notifications/pending`, `POST /api/notifications/:id/ack`).
- Unified notification preferences so Settings and the reminder worker share `UserSettings`.
- CSV and JSON export of subscriptions (`GET /api/data/export/subscriptions`).
- SQLite backup and restore APIs with automatic safety backup before restore.
- Settings UI for export, backup download, restore from file, and restore from local backups.
- Desktop auto-update via `electron-updater` with GitHub Releases publishing.
- Settings UI for checking, downloading, and installing portable desktop updates.
- `npm run dist:desktop:publish` release script and `docs/desktop-auto-update.md`.
- Richer dashboard subscriptions grid with search, status filters, and service logos.
- Recent activity feed for subscription events.
- Renewal snooze (7-day) from the upcoming renewals list.
- Multi-currency formatting via `Intl.NumberFormat`.
- Provider disconnect (`DELETE /api/integrations/:provider`).
- Persisted `logoUrl` on the service catalog.
- Rewritten README covering Gmail OAuth, renewal notifications, and developer setup.

### Changed
- Provider `Connect` actions now include real Gmail OAuth in addition to local connection state.

## [1.0.1] - 2026-05-17

See [`docs/release-notes-v1.0.1.md`](docs/release-notes-v1.0.1.md) for the full notes.

### Added
- Global `HttpExceptionFilter` so API errors return consistent JSON payloads instead of leaking stack traces.
- DTO validation on subscription, settings, and email-ingest endpoints.

### Fixed
- Dashboard monthly spend and spend-by-category now exclude `canceled_pending` subscriptions.
- `subscriptions.service.spec.ts` mocks the `ServiceCatalogService` dependency correctly and uses the `billingAmountCents` integer field.
- Cross-platform `dev:api` / `dev:web` scripts (previous `set VAR=...&&` form only worked on Windows).

### Changed
- Consolidated duplicated fetch helpers in the web client's `lib/api.ts`.

## [1.0.0] - 2026-05 (prior release)

See [`docs/release-notes-v1.0.0.md`](docs/release-notes-v1.0.0.md).

### Added
- Windows portable desktop executable bundling the NestJS API and Next.js web client.
- Local SQLite persistence for subscriptions, integrations, and settings.
- Dashboard summary metrics, renewal stack, and status-change feed.
- Manual subscription CRUD with `SubscriptionEvent` logging.
- Billing email import endpoint that creates or updates subscriptions.

### Known limitations
- Provider `Connect` actions persist local state only — no real third-party OAuth.
- The portable executable is unsigned, so Windows SmartScreen may warn on first launch.
