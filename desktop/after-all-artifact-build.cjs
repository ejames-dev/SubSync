'use strict';

const path = require('node:path');

/**
 * @param {string[]} artifactPaths
 * @returns {string | undefined}
 */
function findWindowsPortableArtifact(artifactPaths) {
  return artifactPaths.find(
    (artifactPath) =>
      artifactPath.endsWith('.exe') &&
      path.basename(artifactPath).startsWith('SubSync-') &&
      !artifactPath.includes('win-unpacked')
  );
}

/**
 * electron-builder skips update metadata for the portable Windows target.
 * Generate latest.yml here so --publish always uploads it with the .exe.
 *
 * @param {import('app-builder-lib').BuildResult} buildResult
 * @returns {Promise<string[]>}
 */
async function afterAllArtifactBuild(buildResult) {
  const portableExe = findWindowsPortableArtifact(buildResult.artifactPaths);

  if (portableExe == null) {
    return [];
  }

  const root = path.resolve(__dirname, '..');
  const { writeWindowsLatestYml } = await import('./windows-latest-yml.mjs');
  const manifestPath = await writeWindowsLatestYml({
    root,
    artifactPath: portableExe,
  });

  return [manifestPath];
}

module.exports = afterAllArtifactBuild;
module.exports.findWindowsPortableArtifact = findWindowsPortableArtifact;
