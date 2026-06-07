# Changelog

All notable changes to SubSync are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Desktop auto-update via `electron-updater` with GitHub Releases publishing.
- Settings UI for checking, downloading, and installing portable desktop updates.
- `npm run dist:desktop:publish` release script and `docs/desktop-auto-update.md`.

### Planned for v1.1.0
- Real OAuth integration for at least one provider (Gmail billing import is the highest-leverage target).
- macOS and Linux desktop builds.
- CSV / JSON export of subscriptions.
- Backup and restore of the local SQLite database.
- Notification worker wired up to the existing reminder preferences.

## [1.0.1] - TBD

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
