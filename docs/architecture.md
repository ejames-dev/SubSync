# Technical Architecture (Streaming Subscription Tracker)

## Overview
```
          ┌────────────┐        ┌────────────────┐
User → UI │  Web/Mobile├──API──▶│ GraphQL/REST   │
          └────────────┘        │ Gateway        │
                                 │ (Express/Nest) │
      Email receipts ───────────▶│                │
                                 ▼                │
                          ┌──────────────┐        │
                          │ Ingestion    │◀──────┘
OAuth providers ─────────▶│ Workers      │
                          └──────────────┘
                                 │
                                 ▼
                          ┌──────────────┐
                          │ SQLite       │
                          └──────────────┘
                                 │
                                 ▼
                          ┌──────────────┐
                          │ Notification │→ Email/Push
                          │ Queue        │
                          └──────────────┘
```

## Frontend
- **Tech:** React (web) + React Native or Expo for mobile; share design tokens via Storybook + Figma.
- **State:** TanStack Query or Apollo client for data fetching, Redux Toolkit for cross-view state if necessary.
- **Auth:** Passwordless magic links (Supabase/Auth0) or OAuth aggregator.
- **Offline considerations:** Cache last-known subscriptions on device; queue manual edits until online.

## API Layer
- **Framework:** NestJS (TypeScript) for structured modules.
- **Endpoints:**
  - `/auth/*` (login, token refresh)
  - `/subscriptions` CRUD
  - `/integrations` (list providers, connect/disconnect)
  - `/notifications` (preferences, reminders)
- **API Shape:** GraphQL for flexible dashboards, REST fallback for ingestion webhooks.
- **Security:** JWT access tokens, short-lived; refresh tokens stored httpOnly. Rate limiting per user.

## Data Storage
- **SQLite:** Core local relational data. Use Prisma or TypeORM.
- **Redis:** Cache service catalog + OAuth state, also for job deduplication.
- **Blob Storage (S3/Azure):** Optional for storing raw email bodies before parsing.

## Ingestion Pipeline
1. **OAuth Connect Flow**
   - User clicks Connect Spotify → API exchanges code for refresh token.
   - Token stored encrypted (KMS/HashiCorp Vault). Metadata recorded in `UserIntegration` table.
2. **Scheduled Sync Jobs**
   - Worker (BullMQ / Temporal) wakes per provider schedule.
   - Fetch subscription status, normalize to `Subscription` schema, diff vs existing records.
   - Emit `SubscriptionEvent` rows + notifications if renewal date changed.
3. **Email Parsing**
   - SES/SendGrid inbound → webhook hitting `/ingest/email`.
   - Parser identifies provider (regex/classifier), extracts amount/date, writes `EmailReceipt` + updates/creates `Subscription`.

## Notifications
- **Queue:** BullMQ backed by Redis.
- **Channels:**
  - Email via Postmark/Sendgrid templates.
  - Push via Expo Push service (mobile) or Web Push for PWA.
- **Logic:** Cron job scans for subscriptions with `next_renewal - lead_time_days = today`. Enqueues reminder tasks.

## Infrastructure
- **Hosting:**
  - Frontend: Vercel/Netlify (web), Expo EAS (mobile builds).
  - Backend: Fly.io/Render or AWS ECS Fargate.
  - DB: Local SQLite file bundled with the app.
- **Secrets:** Managed via platform secrets or Vault. Rotated automatically.
- **Observability:**
  - Logging: Structured JSON logs aggregated in Logtail/Datadog.
  - Metrics: Prometheus-compatible (request latency, job success rate).
  - Alerting: PagerDuty/Slack for ingestion failures.

## Security & Privacy
- **Data minimization:** store only necessary subscription fields; no card PANs.
- **Encryption:** All tokens + email contents encrypted at rest. TLS everywhere.
- **Access controls:** RBAC for admin dashboard, minimal support tooling.
- **Compliance considerations:**
  - SOC2 posture (logging/auditing) if scaling.
  - For email forwarding, include explicit consent + delete pipeline.

## Roadmap Hooks
- Multi-currency normalization service for global users.
- Duplicate detection (same service via multiple providers).
- Spend forecasting + budgeting modules.
- Shared households (invite family members, shared view).
