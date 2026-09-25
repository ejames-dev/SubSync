# SubSync Release Roadmap

> Refreshed September 2026 for v1.3.0. Supersedes the July 2026 roadmap. That
> plan's v1.2.0, v1.3.0 ("Smarter imports"), and v1.4.0 ("Money awareness")
> items have all shipped (see [CHANGELOG.md](../CHANGELOG.md)); only its
> signing work and v2.0.0 remain.

## Current State (v1.3.0)

SubSync is a **local-first desktop app** for tracking streaming, music,
gaming, and media subscriptions. It is built with Electron, a NestJS API, a
Next.js UI, and SQLite.

### Shipped

| Release | Highlights |
|---------|------------|
| v1.1.x | Gmail OAuth billing import, renewal OS notifications, CSV/JSON export, SQLite backup and restore, Windows auto-update, ledger-tracked migrations, and a fix for the ASAR startup crash on the Windows portable build |
| v1.2.0 | macOS (Apple Silicon) and Linux AppImage builds; provider parsers for Netflix, Spotify, and Apple receipts; the `EmailReceipt` audit trail with a review UI; price-change detection; budget alerts, a 3-month forecast, cancellation links with a flagged-for-cancellation status, a yearly review, and the spend-by-category chart; AGPL-3.0 license |
| v1.2.1 | Windows `latest.yml` restored, so auto-update works on Windows again |
| v1.3.0 | Duplicate review (merge or dismiss), trial end dates with countdowns and reminders, monthly and yearly cost comparisons, 9 more catalog services (17 total), and fixes for the subscription edit page and the activity feed |

### Known gaps

- All builds are unsigned: Windows shows a SmartScreen warning, macOS needs
  right-click → Open, and macOS auto-update is blocked.
- macOS builds are Apple Silicon only.
- Service logos load from `logo.clearbit.com`, which no longer serves
  images, so cards show broken logos.
- Email-channel reminders are logged, not sent (there's no SMTP).
- Spend history exists only as raw `SubscriptionEvent` rows; there's no chart
  over time yet.
- SubSync runs on a single machine for a single user, with no sync and no
  mobile app.

---

## v1.3.x — "Trust" patches

Signing is still the biggest onboarding problem, and it unblocks macOS
auto-update.

1. **Windows code signing.** Azure Trusted Signing is the cheapest current
   route. It removes the SmartScreen warning.
2. **macOS signing and notarization.** This unblocks macOS auto-update, which
   Settings currently says is disabled.
3. **Intel macOS build.** Close to free once signing works: add `x64` or
   `universal` to the mac target.
4. **Bundled service logos.** Ship catalog logos with the app instead of
   hot-linking a third-party logo service.

## v1.4.0 — "Insight"

This release builds on data SubSync now collects.

1. **Spend history chart.** Monthly spend over time, built from the
   `price_changed` and `created` events that have been accumulating since
   v1.2.0.
2. **Email reminders over SMTP.** Optional SMTP settings so the email channel
   actually delivers.
3. **More provider parsers.** Google Play, Amazon, and PlayStation Store
   receipts, following the Netflix, Spotify, and Apple parser pattern.
4. **Trial conversion follow-up.** When a trial's end date passes and a paid
   receipt arrives, flip the status to active automatically.

## v2.0.0 — "Beyond one machine"

These are architectural, potentially breaking items that justify the major
version bump:

| Feature | Notes |
|---------|-------|
| **Device sync** | Start with file-based sync: an encrypted SQLite export the user drops in Dropbox or Syncthing. It's a local-first-friendly step before any hosted sync |
| **Mobile companion PWA** | Start with a read-only renewals view. The API is already HTTP; what's missing is exposing it and adding auth |
| **Inbound email forwarding** (`subs+user@subsync.app`) | The first feature that needs hosted infrastructure. It deserves an explicit decision on whether SubSync stays 100% local |
| **Household / multi-user** | Only if there's demand; it touches every table |
| **Spotify / YouTube OAuth** | Sync directly from provider APIs instead of parsing emails |

---

## Release packaging summary

| Release | Theme | Key items |
|---------|-------|-----------|
| **v1.3.x** | "Trust" | Windows and macOS signing, macOS auto-update, Intel macOS build, bundled logos |
| **v1.4.0** | "Insight" | Spend history chart, SMTP reminders, more provider parsers, trial conversion |
| **v2.0.0** | "Beyond one machine" | Device sync, mobile PWA, inbound email, multi-user |

## Sequencing rationale

- **Signing before features.** It unblocks macOS auto-update and fixes the
  worst first-run experience on both desktop platforms.
- **Spend history after events have accumulated.** Price-change events began
  in v1.2.0, so by v1.4.0 there is enough history for the chart to be useful.
- **File-based sync before any hosted service.** This keeps the local-first
  promise intact for as long as possible.

---

## Key file references

```
CHANGELOG.md                                   # Version history
docs/architecture.md                           # Long-term architecture vision
apps/api/src/ingest/parsers/                   # Provider-specific email parsers
apps/api/src/gmail/                            # Gmail OAuth + sync
apps/api/src/reminders/reminder.service.ts     # Renewal, trial, and budget reminders
apps/api/src/common/billing.ts                 # Monthly-equivalent math
apps/api/src/subscriptions/                    # CRUD, duplicate merge/dismiss
apps/api/src/service-catalog/                  # Built-in service catalog (logos, cancel links)
apps/api/prisma/schema.prisma                  # Schema
desktop/migrations.cjs                         # Ledger-tracked migration runner
.github/workflows/release.yml                  # Tag-triggered release build (signing config)
```
