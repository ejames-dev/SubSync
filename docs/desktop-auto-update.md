# Desktop Auto-Update

SubSync uses [`electron-updater`](https://www.electron.build/auto-update) with GitHub Releases to deliver desktop updates.

## Platform support

| Platform | Auto-update | Update manifest | Notes |
| --- | --- | --- | --- |
| Windows portable | Yes | `latest.yml` | Build is currently unsigned, so SmartScreen can still warn on first launch. |
| Linux AppImage | Yes | `latest-linux.yml` | Run the AppImage directly, not an extracted copy, so updater replacement works. |
| macOS Apple Silicon | No | `latest-mac.yml` is published | Disabled until the macOS app is signed and notarized. Settings points users to GitHub Releases. |

## How it works

1. Packaged desktop builds publish per-platform update manifests plus release artifacts to GitHub Releases.
2. The Electron main process checks the configured GitHub feed for a newer version.
3. Users can open **Settings → Desktop updates** to check, download, and install an update.
4. Supported platforms download the new executable and relaunch through `quitAndInstall()`.

Auto-update is disabled when running `npm run dev:desktop` because `app.isPackaged` is false.

## Publishing a release

1. Bump `version` in the root `package.json`.
2. Run the release checklist in `docs/release-checklist.md`.
3. Push a `v{version}` tag or dispatch the **Release** workflow manually. The workflow builds on Windows, macOS Apple Silicon, and Linux hosted runners and uploads artifacts to a draft GitHub Release.

   Alternatively, publish the current platform from a machine with GitHub credentials available to `electron-builder`:

```bash
export GH_TOKEN="<github-token-with-repo-access>"
npm run dist:desktop:publish
```

4. Verify the generated assets in the draft GitHub Release before publishing it:
   - Windows: `SubSync-{version}.exe`, `latest.yml`
   - macOS Apple Silicon: `SubSync {version}-arm64.dmg`, `SubSync {version}-arm64.zip`, `latest-mac.yml`
   - Linux: `SubSync-{version}.AppImage`, `latest-linux.yml`

## GitHub configuration

`package.json` contains:

```json
"publish": {
  "provider": "github",
  "owner": "ejames-dev",
  "repo": "SubSync"
}
```

`electron-builder` uses this metadata to generate update manifests and upload release assets when `--publish always` is passed.

## User flow

1. Launch SubSync.
2. Open **Settings**.
3. Click **Check for updates**.
4. If a release is available, click **Download update**.
5. When the download completes, click **Restart to update**.

## Notes

- Builds are still unsigned. Windows SmartScreen may warn on first launch after updating, and macOS requires right-click Open for fresh downloads.
- macOS automatic updates are intentionally disabled until signing and notarization are configured.
- Auto-update only applies to packaged desktop builds, not browser-only development mode.
- If GitHub is unreachable, Settings shows the error returned by `electron-updater`.
