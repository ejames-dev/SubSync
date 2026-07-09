# SubSync Release Checklist

## Platform builds
Each desktop artifact must be produced on its matching OS runner. `desktop/prepare-dist.mjs` installs the packaged runtime on the build machine, so Prisma engines and any native modules need to match the target OS.

The **Release** GitHub workflow (`.github/workflows/release.yml`) handles this for v1.2.0:

- Windows runner: `SubSync ${VERSION}.exe`
- macOS Apple Silicon runner: `SubSync ${VERSION}-arm64.dmg`, `SubSync ${VERSION}-arm64.zip`
- Linux runner: `SubSync-${VERSION}.AppImage`

Local `npm run dist:desktop` packages only the platform you are currently running.

## Windows build environment (first-time setup, local builds only)
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
- Run `npm run test`
- Run `npm run test:e2e --workspace api`
- Run `npm run build:desktop`
- Run `npm run dist:desktop`
- Smoke-test the local artifact generated for the current OS
- Update `CHANGELOG.md` with the new version's entry and move planned items out of `[Unreleased]`

## Release contents
- Push the `v${VERSION}` tag or dispatch the **Release** workflow manually.
- Confirm the workflow uploads artifacts to a draft GitHub Release.
- Verify the draft release contains:
  - Windows: `SubSync ${VERSION}.exe`, `latest.yml`
  - macOS Apple Silicon: `SubSync ${VERSION}-arm64.dmg`, `SubSync ${VERSION}-arm64.zip`, `latest-mac.yml`
  - Linux: `SubSync-${VERSION}.AppImage`, `latest-linux.yml`
- Publish the draft only after smoke tests pass.
- Include release notes that mention:
  - local SQLite storage
  - dashboard summary metrics
  - Gmail billing import and manual email import
  - automatic SQLite migrations using the `_migrations` ledger
  - desktop notifications and auto-update behavior
  - unsigned Windows and macOS launch warnings, unless the release is code-signed
  - macOS auto-update remains disabled until signing
- Link the Windows quickstart guide in `docs/windows-portable-quickstart.md`
- Link the macOS/Linux quickstart guide in `docs/macos-linux-desktop-quickstart.md`
- If the release remains unsigned, call out the official download source and any checksum/hash users should verify.

## Manual checks
- Launch on a clean Windows user profile if available
- Confirm the unsigned-build SmartScreen path is documented accurately for the release
- Launch on macOS Apple Silicon with right-click Open and confirm Settings reports automatic updates as disabled until signing
- Launch the Linux AppImage directly, confirm it has execute permission, and verify **Check for updates** reaches the GitHub release feed
- In each packaged app, open Settings and verify **Check for updates** reports either the current version or the expected macOS disabled state
- Create one manual subscription
- Import one billing email
- Confirm settings persist across restart
- Confirm dashboard updates after adding and deleting subscriptions

## Post-release
- Verify the GitHub Release asset downloads correctly
- Confirm Windows, macOS, and Linux artifacts start after download
- Track any startup failures, SmartScreen complaints, or false-positive antivirus reports
