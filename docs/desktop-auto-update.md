# Desktop Auto-Update

SubSync uses [`electron-updater`](https://www.electron.build/auto-update) with GitHub Releases to deliver desktop updates.

## Platform support

| Platform | Auto-update | Notes |
| --- | --- | --- |
| Windows portable | ✅ | Update feed: `latest.yml` |
| Linux AppImage | ✅ | Update feed: `latest-linux.yml`; requires running the AppImage directly (not an extracted copy) |
| macOS | ❌ | `electron-updater` refuses to install into an unsigned app, so Settings reports updates as disabled and points to GitHub Releases. Revisit once macOS builds are signed. |

## How it works

1. Packaged desktop builds publish per-platform update manifests (`latest.yml`, `latest-mac.yml`, `latest-linux.yml`) plus the installers to GitHub Releases.
2. The Electron main process checks the configured GitHub feed for a newer version.
3. Users can open **Settings → Desktop updates** to check, download, and install an update.
4. The updater downloads the new build and relaunches through `quitAndInstall()`.

Auto-update is disabled when running `npm run dev:desktop` because `app.isPackaged` is false.

## Publishing a release

1. Bump `version` in the root `package.json`.
2. Run the release checklist in `docs/release-checklist.md`.
3. Push a `v{version}` tag (or run the **Release** workflow manually). CI builds
   Windows, macOS, and Linux artifacts and uploads them to a draft GitHub
   Release.

   Alternatively, publish the current platform's build from a machine with
   GitHub credentials available to `electron-builder`:

```bash
export GH_TOKEN="<github-token-with-repo-access>"
npm run dist:desktop:publish
```

4. Verify the assets in the GitHub Release, then publish the draft:
   - `SubSync {version}.exe` and `latest.yml`
   - `SubSync {version}.dmg`, `SubSync {version}.zip`, and `latest-mac.yml`
   - `SubSync-{version}.AppImage` and `latest-linux.yml`

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

- The builds are unsigned, so Windows SmartScreen may warn on first launch after updating and macOS Gatekeeper requires right-click → Open.
- Auto-update only applies to packaged desktop builds, not browser-only development mode.
- If GitHub is unreachable, Settings shows the error returned by `electron-updater`.
