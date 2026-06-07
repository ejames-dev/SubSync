# SubSync v1.1.0

SubSync 1.1.0 is the first feature release after the initial desktop launch. It adds real Gmail billing import, renewal OS notifications, data export and backup, desktop auto-update, and a polished dashboard experience.

## Highlights

### Gmail billing import
- Read-only Gmail OAuth (`gmail.readonly`) with encrypted token storage
- Connect page UI to link Gmail, sync on demand, and disconnect
- `POST /api/gmail/sync` plus scheduled background sync every 6 hours
- Billing emails from supported providers are parsed into subscriptions automatically

### Renewal reminders
- Hourly reminder worker queues notifications based on your lead-time preference
- Electron desktop app polls and delivers native OS notifications
- Web client polls for browser notifications during local development
- Unified notification preferences shared between Settings and the reminder worker

### Export, backup, and restore
- Export subscriptions as CSV or JSON from Settings
- Create and download full SQLite backups
- Restore from an uploaded file or a local backup list
- Automatic safety backup before any restore operation

### Desktop auto-update
- `electron-updater` checks GitHub Releases for newer portable builds
- Settings card to check, download, and install updates
- `npm run dist:desktop:publish` for maintainers (requires `GH_TOKEN`)

### Dashboard polish
- Subscriptions grid with search, status filters, and service logos
- Recent activity feed for subscription events
- 7-day renewal snooze from the upcoming renewals list
- Multi-currency formatting via `Intl.NumberFormat`
- Provider disconnect (`DELETE /api/integrations/:provider`)

## Upgrade notes

This release includes new Prisma migrations. The desktop app applies them automatically on launch. For local development:

```bash
npm run prisma:migrate --workspace api
npm run prisma:generate --workspace api
```

Gmail OAuth is optional. Add the `GOOGLE_OAUTH_*` variables from `.env.example` to enable billing email import. See [`docs/gmail-oauth-setup.md`](gmail-oauth-setup.md).

## Validation

```
npm run lint
npm run test --workspace api
npm run build:desktop
```

## Known limitations

- Spotify and other streaming provider OAuth remains local-state only (Gmail is the first real OAuth integration).
- The portable executable is unsigned; Windows SmartScreen may warn on first launch.
- macOS and Linux desktop builds are not yet available.
