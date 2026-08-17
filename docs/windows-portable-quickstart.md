# SubSync Windows Portable Quickstart

## Download
1. Open the latest GitHub Release for SubSync.
2. Download the latest `SubSync-{version}.exe` file. The current documented release is `SubSync-1.1.3.exe`.
3. Move the file somewhere you can keep it, such as `Downloads` or `Desktop`.

## Launch
1. Double-click `SubSync-1.1.3.exe` or the newer release you downloaded.
2. Wait for the local API, web UI, and SQLite database to initialize.
3. If Windows SmartScreen appears, review the publisher warning and choose whether to continue.
4. The portable app runs its local API on `127.0.0.1:43100` and its bundled web UI on `127.0.0.1:43101`.

## Windows SmartScreen and unsigned builds

SubSync's Windows portable executable is currently unsigned. That means Windows may show a SmartScreen warning such as "Windows protected your PC" or "Unknown publisher" on first launch, even when the file is the official release.

Before running the app:

1. Download it only from the official SubSync GitHub Releases page.
2. Confirm the filename matches the published release, such as `SubSync-1.1.3.exe`.
3. If the release includes checksums, compare the downloaded file before launching.
4. Do not continue if the file came from a third-party mirror, an email attachment, or an unexpected download prompt.

If you trust the downloaded release and choose to continue, Windows usually requires **More info** and then **Run anyway**. This is a Windows trust prompt for unsigned software, not a SubSync account or network permission prompt.

Code signing would reduce this friction by attaching a publisher identity to the executable, but Windows signing certificates cost money and still need reputation over time. Until SubSync is signed, treat the GitHub Release page as the source of truth.

## What the app stores locally
- SQLite database under your Windows user data directory
- Saved subscriptions
- Saved integration states
- Saved notification settings

## First-use workflow
1. Open `Connections`.
2. Use `Connect` for supported providers or `Import billing email` to create subscriptions from billing messages.
3. Open `Dashboard` to review monthly equivalent spend, upcoming renewals, category spend, and duplicate plans.
4. Open `Settings` to adjust reminder lead time and notification channels.

## Troubleshooting
- If SubSync says a port is already in use, close the conflicting process and launch the app again.
- If the app window opens but stays on startup, close it and relaunch the `.exe`.
- Fresh installs and existing databases should apply SQLite migrations automatically on launch. If startup fails during database setup, keep the error text before resetting data.
- If antivirus software quarantines the app, verify that the file came from the official release before restoring it. Report false positives with the release version and antivirus vendor.
- If you need a clean reset, remove the local SubSync data folder from your Windows user application data area and launch again.
