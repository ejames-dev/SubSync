import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { dirname, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import runtimePaths from './runtime-path.cjs';

const { resolveRuntimePath } = runtimePaths;
let tempDir;

before(async () => {
  tempDir = await mkdtemp(resolve(os.tmpdir(), 'subsync-runtime-path-'));
});

after(async () => {
  await rm(tempDir, { force: true, recursive: true });
});

async function touch(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, '');
}

test('uses the physical extra resource for the packaged web server', async () => {
  const resourcesPath = resolve(tempDir, 'resources');
  const appPath = resolve(resourcesPath, 'app.asar');
  const archivedApi = resolve(appPath, 'runtime', 'api', 'dist', 'main.js');
  const physicalWeb = resolve(
    resourcesPath,
    'runtime',
    'web',
    'apps',
    'web',
    'server.js',
  );

  await touch(archivedApi);
  await touch(physicalWeb);

  assert.equal(
    resolveRuntimePath(appPath, resourcesPath, 'web', 'apps', 'web', 'server.js'),
    physicalWeb,
  );
  assert.equal(
    resolveRuntimePath(appPath, resourcesPath, 'api', 'dist', 'main.js'),
    archivedApi,
  );
});

test('falls back to the development runtime', () => {
  const appPath = resolve(tempDir, 'source');
  const resourcesPath = resolve(tempDir, 'electron');

  assert.equal(
    resolveRuntimePath(appPath, resourcesPath, 'web', 'apps', 'web', 'server.js'),
    resolve(appPath, 'desktop', 'runtime', 'web', 'apps', 'web', 'server.js'),
  );
});
