import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const artifactName = `SubSync-${packageJson.version}.exe`;
const releaseDir = path.join(root, 'release');
const artifactPath = path.join(releaseDir, artifactName);
const artifact = await readFile(artifactPath);
const { size } = await stat(artifactPath);
const sha512 = createHash('sha512').update(artifact).digest('base64');
const releaseDate = new Date().toISOString();

const manifest = [
  `version: ${packageJson.version}`,
  'files:',
  `  - url: ${artifactName}`,
  `    sha512: ${sha512}`,
  `    size: ${size}`,
  `path: ${artifactName}`,
  `sha512: ${sha512}`,
  `releaseDate: '${releaseDate}'`,
  '',
].join('\n');

await writeFile(path.join(releaseDir, 'latest.yml'), manifest, 'utf8');
console.log(`Wrote release/latest.yml for ${artifactName}`);
