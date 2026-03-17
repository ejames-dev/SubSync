# SubSync Release Checklist

## Before tagging
- Run `npm run lint`
- Run `npm run test:e2e --workspace api`
- Run `npm run build:desktop`
- Run `npm run dist:desktop`
- Smoke-test the generated `release/SubSync 1.0.0.exe`

## Release contents
- Upload `release/SubSync 1.0.0.exe` to GitHub Releases
- Include release notes that mention:
  - local SQLite storage
  - dashboard summary metrics
  - connection persistence
  - billing email import
- Link the Windows quickstart guide in `docs/windows-portable-quickstart.md`

## Manual checks
- Launch on a clean Windows user profile if available
- Create one manual subscription
- Import one billing email
- Confirm settings persist across restart
- Confirm dashboard updates after adding and deleting subscriptions

## Post-release
- Verify the GitHub Release asset downloads correctly
- Confirm the portable executable starts after extraction or direct download
- Track any startup failures, SmartScreen complaints, or false-positive antivirus reports
