# SubSync Release Roadmap

> Refreshed July 2026. Supersedes the June 2026 planning-session roadmap, which
> targeted v1.0.1 — nearly all of that plan shipped in v1.1.0–v1.1.2 (see
> [CHANGELOG.md](../CHANGELOG.md)).

## Current State (v1.1.2 + unreleased)

SubSync is a **local-first desktop app** (Electron + NestJS API + Next.js UI +
SQLite) for tracking streaming/media subscriptions.

**Shipped through v1.1.2:**
- Real Gmail OAuth with scheduled billing-email sync (every 6 hours)
- Renewal reminders delivered as OS/browser notifications, unified preferences
- CSV/JSON export, one-click SQLite backup and restore
- Desktop auto-update from GitHub Releases (Windows, Linux)
- Richer subscriptions grid, service logos, multi-currency, snooze, disconnect
- Ordered, ledger-tracked SQLite migrations (no fresh-install crash)
- CI pipeline and tag-triggered Release workflow

**In `[Unreleased]` (lands in v1.2.0):**
- macOS (Apple Silicon) and Linux AppImage builds
- Linux AppImage auto-update; macOS auto-update disabled until signing

**Known gaps:**
- All builds are unsigned (SmartScreen warning on Windows; right-click → Open
  on macOS; macOS auto-update blocked)
- Email parsing is generic heuristics; no provider-specific parsers
- Duplicate detection is flagged by the API but has no review UI
- Email-channel reminders are logged, not sent (no SMTP)
- Single machine, single user — no sync, no mobile

---

## v1.2.0 — "Cross-platform"

The macOS/Linux builds already in `[Unreleased]` are the headline. Round it
out with low-effort leftovers from the previous roadmap:

1. **Spend-by-category chart** on the dashboard — the API already returns the
   category breakdown; UI-only work.
2. **Expanded service catalog** — Paramount+, Apple TV+, Amazon Prime,
   Crunchyroll, Xbox Game Pass, PlayStation Plus, Max, Peacock, Audible,
   Nintendo Switch Online.
3. **Duplicate-review UI** — the dashboard API already flags duplicates; add a
   "Review duplicates" banner with merge/dismiss actions.

## v1.2.x — Trust and correctness patches

Signing comes before new features: it unblocks macOS auto-update and removes
the scariest part of onboarding.

1. **Windows code signing** (Azure Trusted Signing is the cheapest current
   route) — removes the SmartScreen warning; prerequisite for wider
   distribution.
2. **macOS signing + notarization** — unblocks macOS auto-update, which the
   Settings page currently apologizes for.
3. **Intel macOS build** — nearly free once signing is sorted (add `x64` or
   `universal` to the mac target).

## v1.3.0 — "Smarter imports"

The import pipeline is the product's differentiator; deepen it.

1. **Provider-specific email parsers** (Netflix, Spotify, Apple receipts)
   replacing generic heuristics. Apple receipts especially — they aggregate
   many subscriptions in one email.
2. **`EmailReceipt` audit table** — every parsed email traceable to the
   subscription it created or updated, with a review UI for low-confidence
   parses.
3. **Price-change detection** — when a Gmail sync sees a new amount for an
   existing subscription, log a `price_changed` event and notify. "SubSync
   told me Netflix went up $3" is the killer moment for this app.
4. **Trial and annual plan support** — trial-end countdowns and
   annual ↔ monthly cost comparison.

## v1.4.0 — "Money awareness"

1. **Budget alerts** — notify when monthly-equivalent spend crosses a user-set
   threshold; reuses the existing reminder worker and notification queue.
2. **Spend forecasting** — "you'll spend $X over the next 3 months" from known
   renewal dates; natural spot for a spend-history chart once
   `SubscriptionEvent` accumulates enough data.
3. **Cancellation assistance** — per-service "how to cancel" deep links in the
   catalog plus a "flagged for cancellation" status. Low effort, high
   perceived value.
4. **Yearly review** — "your subscriptions in 2026": total spent, biggest
   increases, unused-looking services.

## v2.0.0 — "Beyond one machine"

Architectural / breaking-ish items that justify the major bump:

| Feature | Notes |
|---------|-------|
| **Device sync** | Start with file-based sync (encrypted SQLite export the user drops in Dropbox/Syncthing) — a local-first-friendly stepping stone before any hosted sync |
| **Mobile companion PWA** | Read-only renewals view first; the API is already HTTP — the gap is exposure and auth |
| **Inbound email forwarding** (`subs+user@subsync.app`) | First feature requiring hosted infrastructure — deserves an explicit decision on whether SubSync stays 100% local |
| **Household / multi-user** | Only if there's demand; touches every table |
| **Spotify / YouTube OAuth** | Direct API sync instead of email parsing |

---

## Release packaging summary

| Release | Theme | Key items |
|---------|-------|-----------|
| **v1.2.0** | "Cross-platform" | macOS/Linux builds (done), spend chart, expanded catalog, duplicate review |
| **v1.2.x** | "Trust" | Windows + macOS signing, macOS auto-update, Intel macOS build |
| **v1.3.0** | "Smarter imports" | Provider parsers, `EmailReceipt` audit, price-change detection, trial/annual support |
| **v1.4.0** | "Money awareness" | Budget alerts, forecasting, cancellation assistance, yearly review |
| **v2.0.0** | "Beyond one machine" | Device sync, mobile PWA, inbound email, multi-user |

## Sequencing rationale

- **Signing before features** — it unblocks macOS auto-update and fixes the
  worst first-run experience on both platforms.
- **Price-change detection before forecasting** — it makes the Gmail
  integration visibly valuable every month, while forecasting needs
  accumulated event history to be interesting.
- **File-based sync before hosted anything** — keeps the local-first promise
  intact as long as possible.

---

## Key file references

```
CHANGELOG.md                                   # Version history
docs/architecture.md                           # Long-term architecture vision
docs/wireframes.md                             # UI targets (charts, sidebar)
apps/api/src/ingest/                           # Email parsing (needs provider parsers)
apps/api/src/gmail/                            # Gmail OAuth + sync (price-change hook point)
apps/api/src/reminders/reminder.service.ts     # Reminder worker (budget-alert hook point)
apps/api/src/dashboard/                        # Summary + duplicate flags (chart / review UI data)
apps/api/prisma/schema.prisma                  # Schema (EmailReceipt, trial fields)
desktop/main.cjs                               # Electron entry + migration runner
.github/workflows/release.yml                  # Tag-triggered release build (signing config)
```
