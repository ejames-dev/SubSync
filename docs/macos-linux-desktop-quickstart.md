# SubSync macOS and Linux Desktop Quickstart

## Download
1. Open the latest GitHub Release for SubSync.
2. Download the artifact for your platform:
   - macOS Apple Silicon: `SubSync {version}.dmg`
   - Linux: `SubSync-{version}.AppImage`
3. Do not run builds from mirrors, email attachments, or unexpected download prompts.

## macOS launch
The macOS build is unsigned until SubSync adds Apple Developer signing and notarization. On first launch, macOS Gatekeeper may block a normal double-click.

1. Open the downloaded `.dmg`.
2. Drag SubSync into `Applications`.
3. In Finder, right-click SubSync and choose `Open`.
4. Confirm that you want to open the app if macOS shows an unidentified-developer warning.

Automatic updates are disabled on macOS until builds are signed. Download new macOS versions from the official GitHub Release.

## Linux AppImage launch
1. Move `SubSync-{version}.AppImage` somewhere stable, such as `~/Applications`.
2. Make it executable:

```bash
chmod +x SubSync-{version}.AppImage
```

3. Launch the AppImage directly:

```bash
./SubSync-{version}.AppImage
```

Linux AppImage auto-update uses the GitHub Release update feed. Run the AppImage itself, not an extracted copy, so the updater can replace the executable correctly.

## First-use workflow
1. Open `Connections`.
2. Connect Gmail or import a billing email manually.
3. Open `Dashboard` to review monthly spend, upcoming renewals, category spend, and duplicate plans.
4. Open `Settings` to adjust reminders and check desktop update status.

## Troubleshooting
- If macOS says the app is damaged or cannot be opened, remove the downloaded copy and download it again from the official GitHub Release.
- If Linux does not launch the AppImage, confirm it has execute permission and is on a filesystem that allows executable files.
- If update checks fail, confirm the app was downloaded from GitHub Releases and that GitHub is reachable.
