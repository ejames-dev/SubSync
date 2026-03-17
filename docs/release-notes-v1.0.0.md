# SubSync v1.0.0

## Windows Download
- `SubSync 1.0.0.exe`

## What is included
- Portable Windows desktop executable
- Embedded local API and SQLite database
- Dashboard summary metrics backed by local data
- Manual subscription management
- Saved connection state for supported providers
- Billing email import that creates or updates subscriptions
- Persisted notification settings
- No Docker or Postgres requirement

## How to use it
1. Download `SubSync 1.0.0.exe` from this release.
2. Run the executable.
3. Open `Connections` to save provider links or import a billing email.
4. Open `Dashboard` to review renewals, spend, and duplicate subscriptions.
5. Open `Settings` to adjust reminder preferences.

## Notes
- All app data is stored locally on the machine.
- Provider `Connect` actions currently save local connection state. Real third-party OAuth sync is not included in this release.
- Billing email import is the primary automated ingestion path in `v1.0.0`.

## Validation
- `npm run lint`
- `npm run test:e2e --workspace api`
- `npm run build:desktop`
- `npm run dist:desktop`
- `npm audit --omit=dev` for the staged desktop runtime

## Known limitations
- Provider sync is not yet a full live OAuth integration.
- The portable executable is unsigned, so Windows SmartScreen may warn on first launch.
