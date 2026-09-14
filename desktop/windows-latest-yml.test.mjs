import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  getWindowsPortableArtifactName,
  writeWindowsLatestYml,
} from './windows-latest-yml.mjs';

test('writeWindowsLatestYml matches electron-updater latest.yml shape', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'subsync-manifest-'));
  try {
    const version = '9.9.9-test';
    const artifactName = getWindowsPortableArtifactName(version);
    const payload = Buffer.from('portable-exe-fixture');
    const releaseDir = path.join(root, 'release');
    const artifactPath = path.join(releaseDir, artifactName);
    await mkdir(releaseDir, { recursive: true });
    await writeFile(artifactPath, payload);
    await writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ version }),
      'utf8'
    );

    const manifestPath = await writeWindowsLatestYml({ root, artifactPath });
    const manifest = await readFile(manifestPath, 'utf8');
    const sha512 = createHash('sha512').update(payload).digest('base64');

    assert.match(manifest, /^version: 9\.9\.9-test\n/);
    assert.ok(manifest.includes(`url: ${artifactName}`));
    assert.ok(manifest.includes(`sha512: ${sha512}`));
    assert.ok(manifest.includes(`size: ${payload.length}`));
    assert.ok(manifest.includes(`path: ${artifactName}`));
    assert.match(manifest, /releaseDate: '/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
