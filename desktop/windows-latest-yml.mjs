import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * @param {string} version
 */
export function getWindowsPortableArtifactName(version) {
  return `SubSync-${version}.exe`;
}

/**
 * @param {string} root
 * @param {string} version
 */
export function getWindowsPortableArtifactPath(root, version) {
  return path.join(
    path.resolve(root),
    'release',
    getWindowsPortableArtifactName(version)
  );
}

/**
 * Writes electron-updater compatible latest.yml next to the Windows portable exe.
 *
 * @param {{ root: string, artifactPath?: string, version?: string }} options
 * @returns {Promise<string>} Absolute path to latest.yml
 */
export async function writeWindowsLatestYml(options) {
  const root = path.resolve(options.root);
  const packageJson = JSON.parse(
    await readFile(path.join(root, 'package.json'), 'utf8')
  );
  const version = options.version ?? packageJson.version;
  const artifactName = getWindowsPortableArtifactName(version);
  const artifactPath =
    options.artifactPath ?? path.join(root, 'release', artifactName);
  const releaseDir = path.dirname(artifactPath);

  const artifact = await readFile(artifactPath);
  const { size } = await stat(artifactPath);
  const sha512 = createHash('sha512').update(artifact).digest('base64');
  const releaseDate = new Date().toISOString();

  const manifest = [
    `version: ${version}`,
    'files:',
    `  - url: ${artifactName}`,
    `    sha512: ${sha512}`,
    `    size: ${size}`,
    `path: ${artifactName}`,
    `sha512: ${sha512}`,
    `releaseDate: '${releaseDate}'`,
    '',
  ].join('\n');

  const manifestPath = path.join(releaseDir, 'latest.yml');
  await writeFile(manifestPath, manifest, 'utf8');
  return manifestPath;
}
