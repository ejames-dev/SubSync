# Third-party software notices

SubSync incorporates open-source packages maintained by their respective
authors. Those packages are not relicensed under SubSync's AGPL-3.0-only
license; their original copyright notices and license terms continue to apply.
Full license texts are distributed with the packages and are available from
their linked upstream projects and npm package pages.

## Principal runtime components

| Component | License |
| --- | --- |
| Electron | MIT |
| Next.js and React | MIT |
| NestJS | MIT |
| Prisma Client | Apache-2.0 |
| RxJS | Apache-2.0 |
| SQLite | Public domain |
| Tailwind CSS | MIT |

The complete dependency graph and pinned versions are recorded in
`package-lock.json`. Package-specific notices and license files in installed
dependencies remain authoritative.

## Compatibility audit

An automated metadata scan of the installed dependency tree was performed on
2026-07-15 before adopting AGPL-3.0-only. The declared licenses observed were
MIT, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD, Apache-2.0, MPL-2.0, BlueOak-1.0.0,
CC0-1.0, CC-BY-4.0, Python-2.0, Unlicense, WTFPL, and permissive combinations of
those licenses. Packages without a scalar SPDX field were checked against their
included license files or identified as local workspace links. No known license
conflict with AGPLv3 was identified.

This audit is a point-in-time engineering check, not legal advice. Dependency
licenses must be reviewed again whenever dependencies or build contents change.
