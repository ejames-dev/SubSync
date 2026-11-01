# SubSync v1.1.3

This patch release replaces the broken v1.1.2 Windows portable build.

## Fixed

- The desktop app now starts its bundled web interface from a physical runtime
  directory, avoiding the `ENOENT` error caused when Next.js tried to change
  the working directory inside Electron's ASAR archive.
- The packaged web runtime now includes the complete traced dependency tree.
- Automated Windows package validation launches the built app and requires
  successful responses from both the local API and dashboard before release.

## Installation note

SubSync remains an unsigned Windows portable executable. Download it only from
the official GitHub release. Windows SmartScreen may show an "Unknown
publisher" warning; see the
[Windows portable quickstart](windows-portable-quickstart.md) for the expected
launch flow.
