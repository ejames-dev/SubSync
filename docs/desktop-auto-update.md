# Desktop Auto-Update

SubSync uses [`electron-updater`](https://www.electron.build/auto-update) with GitHub Releases to deliver portable Windows updates.

## How it works

1. Packaged desktop builds publish `latest.yml` plus `SubSync {version}.exe` to GitHub Releases.
2. The Electron main process checks the configured GitHub feed for a newer version.
3. Users can open **Settings → Desktop updates** to check, download, and install an update.
4. Portable builds download the new executable and relaunch through `quitAndInstall()`.

Auto-update is disabled when running `npm run dev:desktop` because `app.isPackaged` is false.

## Publishing a release

1. Bump `version` in the root `package.json`.
2. Run the release checklist in `docs/release-checklist.md`.
3. Publish from a machine with GitHub credentials available to `electron-builder`:

```bash
export GH_TOKEN="<github-token-with-repo-access>"
npm run dist:desktop:publish
```

4. Upload or verify the generated assets in the GitHub Release:
   - `SubSync {version}.exe`
   - `latest.yml`

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

- The portable executable is still unsigned, so Windows SmartScreen may warn on first launch after updating.
- Auto-update only applies to packaged desktop builds, not browser-only development mode.
- If GitHub is unreachable, Settings shows the error returned by `electron-updater`.
