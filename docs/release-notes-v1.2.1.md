# SubSync v1.2.1

Patch release restoring Windows in-app auto-update for portable builds.

## Fixed

- CI and local publish flows now generate and upload `latest.yml` alongside
  `SubSync-{version}.exe`, so Settings → **Check for updates** works on
  Windows again ([#41](https://github.com/ejames-dev/SubSync/issues/41)).

## Installation note

SubSync remains an unsigned Windows portable executable. Download only from
the official GitHub release. Windows SmartScreen may show an "Unknown
publisher" warning; see the
[Windows portable quickstart](windows-portable-quickstart.md).
