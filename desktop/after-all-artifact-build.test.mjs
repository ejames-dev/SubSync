import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const {
  findWindowsPortableArtifact,
} = require('./after-all-artifact-build.cjs');

test('findWindowsPortableArtifact ignores unpacked dir and picks portable exe', () => {
  const releaseDir = '/build/release';
  const portableExe = path.join(releaseDir, 'SubSync-1.2.0.exe');
  const picked = findWindowsPortableArtifact([
    path.join(releaseDir, 'win-unpacked', 'SubSync.exe'),
    portableExe,
    path.join(releaseDir, 'builder-debug.yml'),
  ]);
  assert.equal(picked, portableExe);
});

test('findWindowsPortableArtifact returns undefined when no portable build ran', () => {
  assert.equal(
    findWindowsPortableArtifact([
      '/build/release/SubSync 1.2.0-arm64.dmg',
      '/build/release/latest-linux.yml',
    ]),
    undefined
  );
});
