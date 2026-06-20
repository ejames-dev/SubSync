# SubSync Release Checklist

## Windows build environment (first-time setup)
The desktop `.exe` (`electron-builder --win portable`) must be built on **native
Windows** — it cannot be produced from WSL/Linux. `desktop/prepare-dist.mjs`
shells out to `cmd.exe` for its `npm install` step, so a real Windows host is
required. Git Bash, PowerShell, or `cmd` all work; the commands below use Git Bash.

1. **Git** — install [Git for Windows](https://git-scm.com/download/win) (provides Git Bash). Skip if `git --version` already works.
2. **Node** — install the [Node.js Windows .msi](https://nodejs.org), **LTS / Node 22.x** to match the WSL toolchain. Keep "Add to PATH" checked. Leave the "Tools for Native Modules (installs Chocolatey)" box **unchecked** — SubSync needs no native compilation (Prisma ships a prebuilt query engine). Reopen the terminal, then confirm `node -v` and `npm -v`.
3. **Clone** the repo on the Windows side (separate from any WSL checkout):
   ```bash
   git clone https://github.com/ejames-dev/SubSync.git
   cd SubSync
   ```
4. **GitHub token** (only for publishing) — create a classic PAT with the `repo` scope at GitHub → Settings → Developer settings → Personal access tokens. Export it before publishing: `export GH_TOKEN="<token>"` (Git Bash) or `$env:GH_TOKEN="<token>"` (PowerShell).

## Before tagging
- Run `npm run lint`
- Run `npm run test:e2e --workspace api`
- Run `npm run build:desktop`
- Run `npm run dist:desktop`
- Smoke-test the generated `release/SubSync ${VERSION}.exe`
- Update `CHANGELOG.md` with the new version's entry and move planned items out of `[Unreleased]`

## Release contents
- Publish with `npm run dist:desktop:publish` (requires `GH_TOKEN`) or upload `release/SubSync ${VERSION}.exe` and `release/latest.yml` to GitHub Releases manually
- Include release notes that mention:
  - local SQLite storage
  - dashboard summary metrics
  - connection persistence
  - billing email import
- Link the Windows quickstart guide in `docs/windows-portable-quickstart.md`

## Manual checks
- In the packaged app, open Settings and verify **Check for updates** reports the current version
- Launch on a clean Windows user profile if available
- Create one manual subscription
- Import one billing email
- Confirm settings persist across restart
- Confirm dashboard updates after adding and deleting subscriptions

## Post-release
- Verify the GitHub Release asset downloads correctly
- Confirm the portable executable starts after extraction or direct download
- Track any startup failures, SmartScreen complaints, or false-positive antivirus reports
