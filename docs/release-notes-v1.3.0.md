# SubSync v1.3.0

SubSync 1.3.0 finishes the leftover roadmap work: you can now clean up
duplicate subscriptions, track free trials before they start billing, and see
what any plan costs per month and per year. The service catalog also nearly
doubles in size. As always, everything runs locally: your subscriptions,
settings, and import history stay in a SQLite database on your machine.

## Highlights

### Review duplicates
- When the same service is tracked more than once, the dashboard shows a
  **Review duplicates** banner.
- In the dialog, pick the entry to keep and choose **Merge into selected**, or
  choose **Not duplicates** if the entries really are separate plans, such as
  two accounts.
- Merging moves the removed entries' history, email receipt links, and
  pending notifications onto the kept subscription, and records a
  "Duplicates merged" event. The kept entry takes over the email import key,
  so the next Gmail sync updates it instead of creating the duplicate again.
- A group marked as not duplicates stays hidden until a new entry for that
  service is added.

### Trial tracking
- Setting a subscription's status to **Trial** now asks for the date the trial
  ends.
- Subscription cards show a countdown, such as "Trial ends in 3 days",
  highlighted in the final week.
- A one-time desktop notification arrives within your reminder lead time
  before the trial converts to a paid plan.

### Monthly and yearly cost at a glance
- Yearly and quarterly plans show their monthly equivalent (for example,
  `≈ $11.58/mo` for a $139/year plan).
- Monthly plans show their yearly total.
- The comparison updates live while you fill in the subscription form.

### Expanded service catalog
- New services: Paramount+, Amazon Prime, Crunchyroll, HBO Max, Peacock, Xbox
  Game Pass, PlayStation Plus, Nintendo Switch Online, and Audible.
- Each one links to the provider's official cancellation instructions.
- Existing installs pick them up automatically, and billing emails from these
  providers can now be matched to catalog entries.

### Fixes
- **Manage** links on subscription cards open the edit page again instead of a
  not-found page.
- The recent activity feed updates right after you merge, snooze, or delete a
  subscription.

## Still included

- Dashboard summary metrics: monthly spend, the budget, a three-month
  forecast, spend by category, and upcoming renewals.
- Gmail billing import (read-only OAuth, synced every 6 hours) and manual
  email import from pasted receipts.
- Desktop notifications for renewals, budget alerts, price changes, and now
  trial endings.
- In-app auto-update from GitHub Releases on Windows and Linux.

## Upgrade notes

This release adds two SQLite migrations: `20260925120000_duplicate_review` and
`20260925130000_trial_tracking`. The desktop app applies them automatically on
launch and records them in the `_migrations` ledger, so no manual steps are
needed. For local development:

```bash
cd apps/api
DATABASE_URL="file:./dev.db" npm run prisma:migrate
DATABASE_URL="file:./dev.db" npm run prisma:generate
```

Trial subscriptions created before this release keep working without an end
date. You're asked for one the next time you save the subscription with Trial
status.

## Installation and platform notes

- **Windows:** `SubSync-1.3.0.exe` is an unsigned portable executable. Windows
  SmartScreen may show an "Unknown publisher" warning. See the
  [Windows portable quickstart](windows-portable-quickstart.md).
- **macOS (Apple Silicon):** the `.dmg` and `.zip` are unsigned, so
  right-click the app and choose **Open** on first launch. Automatic updates
  stay disabled on macOS until builds are signed. Settings explains this and
  links to GitHub Releases. See the
  [macOS and Linux quickstart](macos-linux-desktop-quickstart.md).
- **Linux:** make the AppImage executable (`chmod +x SubSync-1.3.0.AppImage`).
  It auto-updates through Settings.

Because the builds are unsigned, download SubSync only from the official
[GitHub Releases page](https://github.com/ejames-dev/SubSync/releases). Before
running the file, check that its SHA-256 hash matches the digest GitHub shows
next to the asset. For example, run `sha256sum SubSync-1.3.0.AppImage` on
Linux, `shasum -a 256` on macOS, or `Get-FileHash` in PowerShell.

## Validation

```bash
npm run lint
npm run test
npm run test:e2e --workspace api
npm run build:desktop
```

## Known limitations

- Builds remain unsigned. Code signing is the next item on the roadmap.
- macOS builds are Apple Silicon only.
- Email-channel reminders are logged, not sent; desktop and push
  notifications are the working path.
