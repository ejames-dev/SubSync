# SubSync Release Roadmap

> Saved from product planning session (June 2026). Approved by project owner as the direction for upcoming releases.

## Current State (v1.0.1)

SubSync is a **local-first Windows desktop app** (Electron + NestJS API + Next.js UI + SQLite) for tracking streaming/media subscriptions. It has solid CRUD, dashboard metrics, heuristic email import, and event logging — but several features are stubbed, duplicated, or already built but not wired up.

**Known gaps:**
- OAuth is simulated (no real provider token exchange)
- Notifications cron only logs (no OS/email delivery)
- Dual settings systems (`UserSettings` vs `NotificationPreference`)
- SQLite migration ordering risk on fresh databases
- Richer `subscriptions-grid.tsx` exists but is unused
- Branding inconsistency ("SubSync" vs "Beacon")
- Windows portable only; no auto-update

---

## Tier 1 — Ship the Core Promise (Highest Impact)

Close the gap between what the UI implies and what actually works.

### 1. Real Gmail OAuth + Billing Email Import
- **Status:** Connect is simulated; email import is manual paste only.
- Implement OAuth for Gmail as the first real integration (highest-leverage target per `CHANGELOG.md`).
- Fetch billing/receipt emails automatically on a schedule.
- Store encrypted refresh tokens locally.
- Transforms SubSync from a manual tracker into an auto-updating one.

### 2. Working Renewal Notifications
- **Status:** `ReminderService` runs hourly and only logs.
- Wire the cron job to **Electron native notifications** (natural fit for desktop app).
- Unify `UserSettings` and `NotificationPreference` into one source of truth so Settings page and reminder worker agree on lead time and channels.

### 3. Export, Backup, and Restore
- **Status:** Planned for v1.1.0; not implemented.
- **CSV/JSON export** of subscriptions (spreadsheets, migration).
- **One-click SQLite backup/restore** from Settings — critical for local-only app with no cloud sync.

### 4. Auto-Update for Portable Build
- **Status:** Users must manually download new `.exe` files.
- Add `electron-updater` pointed at GitHub Releases.
- "Check for updates" action in Settings.

---

## Tier 2 — Quick Wins from Code Already in the Repo

### 5. Wire Up the Richer Subscriptions Grid
- `subscriptions-grid.tsx` has search, URL-synced filters, service logos, and "Manage →" links.
- Dashboard currently uses simpler `dashboard-client.tsx`. Swap or merge — mostly integration work.

### 6. Implement Snooze / Dismiss on Renewals
- Dashboard shows Pause icon on renewal rows with **no handler**.
- Wireframes call for "Snooze / Mark handled."
- Add `snoozedUntil` field (or similar) and hook up the button.

### 7. Status-Change Feed on Dashboard
- `GET /api/subscriptions/events/recent` exists; `getRecentSubscriptionEvents` in API client.
- Nothing renders it. Add a "Recent activity" panel.

### 8. Service Logos End-to-End
- `logoUrl` in seed data and types but dropped when reading from DB.
- Add to Prisma schema; surface logos on dashboard.

### 9. Multi-Currency Display
- Amounts always shown as `$` regardless of `billingCurrency`.
- Use `Intl.NumberFormat` with stored currency code.

### 10. Provider Disconnect
- Connect works; disconnect does not.
- Add `DELETE /api/integrations/:provider` and Disconnect button on Connect page.

---

## Tier 3 — Platform and Reliability

### 11. Fix SQLite Migration Ordering
- Migrations run by folder name on every launch with no ledger.
- `init_sqlite` runs after `ALTER TABLE` migrations — fails on fresh DB.
- Consolidate/reorder migrations; add idempotency or `_migrations` tracking table.

### 12. macOS and Linux Desktop Builds
- Currently Windows portable only.
- `electron-builder` supports all three; mostly config and CI work.

### 13. CI Pipeline
- No `.github/workflows` today.
- Minimal pipeline: lint, API tests, `build:desktop` on PR.

### 14. Branding Consistency
- Product is "SubSync" in docs/desktop; UI says **"Beacon | Subscription Command"**; email aliases use `beacon.app`.
- Pick one brand before public release.

---

## Tier 4 — User-Facing Polish

### 15. Spend Insights Chart
- Wireframes include "Spend by category" chart; API already returns category breakdown.
- Simple bar or donut chart on dashboard.

### 16. Subscription Detail Sidebar
- Wireframes: slide-in panel (Overview, Billing, History, Notes) instead of separate page.

### 17. Expand Service Catalog
- Only 5 seeded: Spotify, YouTube Premium, Netflix, Disney+, Hulu.
- Add Paramount+, Apple TV+, Amazon Prime, Xbox Game Pass, etc.

### 18. Stronger Email Parsing
- Ingest defaults to `$9.99` when no amount found; generic heuristics.
- Provider-specific parsers (Netflix, Spotify, Apple).

### 19. Trial and Annual Plan Support
- Surface trial end dates; show annual vs monthly cost comparisons.

### 20. Duplicate Subscription Detection UI
- Dashboard API already flags duplicates; add "Review duplicates" banner with merge/dismiss actions.

---

## Tier 5 — Longer-Term (v1.2+)

| Feature | Why it matters |
|---------|----------------|
| **Spotify / YouTube OAuth** | Direct API sync instead of email parsing |
| **`EmailReceipt` audit table** | Traceability for every parsed email |
| **Spend forecasting** | "You'll spend $X over the next 3 months" |
| **Budget alerts** | Notify when monthly spend exceeds threshold |
| **Shared household / multi-user** | Couples/families tracking together |
| **Inbound email forwarding** | Real `subs+user@subsync.app` pipeline instead of paste |
| **Code signing** | Reduce Windows SmartScreen warnings |
| **Mobile companion (PWA or RN)** | Check renewals on the go |

---

## Suggested Release Packaging

| Release | Theme | Key items |
|---------|-------|-----------|
| **v1.1.0** | "It actually works" | Gmail OAuth, OS notifications, export/backup, auto-update, migration fix, branding cleanup |
| **v1.1.1** | "Polish" | Richer grid, logos, multi-currency, snooze, disconnect, spend chart |
| **v1.2.0** | "Platform" | macOS/Linux builds, CI, expanded catalog, stronger email parsing |
| **v2.0.0** | "Scale" | Multi-user, forecasting, mobile, real inbound email |

---

## Top 5 — Maximum Impact, Reasonable Scope

1. **Gmail OAuth** — transforms product from manual to automatic
2. **OS renewal notifications** — delivers on the reminder promise
3. **Backup/restore + export** — essential for local-only app
4. **Wire up `subscriptions-grid.tsx` + logos** — big UX upgrade from existing code
5. **Auto-update** — keeps portable users current without friction

---

## Key File References

```
docs/CHANGELOG.md                              # v1.1.0 planned items
docs/architecture.md                           # Long-term architecture vision
docs/wireframes.md                             # UI targets (snooze, charts, sidebar)
apps/api/src/integrations/                     # Simulated OAuth (needs real impl)
apps/api/src/reminders/reminder.service.ts     # Logs only (needs delivery)
apps/web/src/components/subscriptions-grid.tsx # Built but unused
apps/web/src/components/dashboard-client.tsx   # Current dashboard
apps/api/prisma/migrations/                    # Migration ordering issue
desktop/main.cjs                               # Electron entry + migration runner
```
