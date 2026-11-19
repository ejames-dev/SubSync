# SubSync Release Roadmap

> Refreshed November 2026. Reflects shipped features through **v1.2.1** (see
> [CHANGELOG.md](../CHANGELOG.md)) and defines the post-v1.2.1 release plan.

## Current State (v1.2.1)

SubSync is a **local-first desktop and web subscription command center**
(Electron + NestJS API + Next.js UI + SQLite).

**Shipped through v1.2.1:**
- Cross-platform desktop builds: Windows portable `.exe` (with `latest.yml`
  auto-update), macOS Apple Silicon `.dmg`/`.zip`, and Linux `AppImage`
  auto-update
- Real Gmail OAuth with 6-hour scheduled billing-email sync, `EmailReceipt`
  audit ledger, provider parsers (`apple`, `netflix`, `spotify`, `generic`),
  and low-confidence import review queue (`/imports/review`)
- Price-change detection (`price_changed` events and push notifications)
- Renewal reminders via OS/browser notifications and unified `UserSettings`
- Spend-by-category dashboard breakdown, monthly budget alerts, 3-month rolling
  spend forecast, duplicate-plan merge/dismiss workflow, cancellation deep
  links, and estimated Yearly Review (`/insights/yearly-review`)
- CSV/JSON subscription export and one-click SQLite backup & restore
- Ordered, ledger-tracked SQLite migrations (`desktop/migrations.cjs`)

---

## v1.3.0 — "Track Anything, Accurately" (Core Lifecycle & Custom Catalog)

1. **Automatic renewal rollover & actual charge events** — advance elapsed
   `nextRenewal` dates for active subscriptions by billing cadence, reset
   `nextRenewalReminderSent`, record `renewal` `SubscriptionEvent` snapshots,
   and auto-archive elapsed `canceled_pending` subscriptions to a terminal
   `canceled` state so historical yearly spend is preserved without deletion.
2. **Custom services, expanded categories & tags** — user-created custom
   services (`POST /api/services`, `PATCH /api/services/:id`) beyond the
   built-in catalog, broader categories (`saas`, `productivity`, `cloud`,
   `utilities`, `fitness`), and user-defined subscription tags.
3. **True trial countdowns, paused state & flexible cadences** — `paused` and
   `canceled` statuses, `trialEndsAt` + `postTrialAmountCents` with dedicated
   pre-conversion alerts, per-subscription reminder `leadTimeDaysOverride`, and
   exact cadence math for `weekly` and `customIntervalDays`.

## v1.4.0 — "Always-On Command Center" (Desktop Resident Mode & UX Power Tools)

1. **System tray, minimize-to-tray & launch at login** — Electron `Tray` /
   macOS menu bar quick-status menu, optional background resident mode when the
   window closes so `@Cron` reminders and Gmail sync continue running, launch
   at login toggle, and clickable OS notifications that deep-link directly to
   `/subscriptions/:id`.
2. **Interactive renewal calendar & rich price timelines** — monthly renewal
   calendar view (`/calendar`), structured `previousAmount` → `amount` badges on
   subscription timelines and activity feeds, visible snooze status with custom
   snooze durations, dark mode, grid sorting & bulk actions, and a pending
   review count badge on `Imports`.

## v1.5.0 — "Zero-Friction Imports" (Universal Portability & Smarter Parsing)

1. **CSV / JSON subscription importer & local bank statement analyzer** —
   symmetric `POST /api/data/import/subscriptions` for restoring exports or
   migrating from spreadsheets, plus a 100% local bank/card CSV recurring-charge
   detector that queues candidate subscriptions into `/imports/review`.
2. **Expanded provider parsers, cancellation detection, `.eml` upload & IMAP** —
   deterministic `importKey` deduplication, dedicated parsers for Amazon Prime,
   Disney+/Hulu, YouTube/Google Play, Xbox/Microsoft, PlayStation, and Steam,
   cancellation & trial email detection, `.eml` receipt file upload, and local
   IMAP inbox sync alongside Gmail.

## v2.0.0 — "Household & Local-First Ecosystem"

1. **Offline-resilient multi-currency FX normalization** — cached SQLite
   exchange rates with manual offline overrides so `DashboardService` and
   `YearlyReviewService` normalize foreign-currency subscriptions into
   `budgetCurrency`.
2. **Family plan cost splitting & bundle modeling** — `totalSeats`,
   `sharedSeats`, `personalShareCents`, and `bundleParentId` to distinguish
   gross billed outflow from net personal spend and avoid false duplicate alerts
   on bundles like Apple One.
3. **Encrypted folder sync, `.ics` calendar feed & outbound alerts** —
   AES-256-GCM encrypted sync snapshots for Syncthing/iCloud/Dropbox, subscribable
   `GET /api/calendar/renewals.ics` feed, and real SMTP + webhook notification
   delivery (`ntfy.sh`, Discord, Slack, generic JSON webhooks).
4. **Code signing & CI test hardening** — Windows & macOS signing/notarization
   hooks, API e2e tests in CI, and automated web test coverage.
