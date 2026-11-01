const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

function resolveRuntimePath(appPath, resourcesPath, ...parts) {
  const extraResourcePath = resolve(resourcesPath, 'runtime', ...parts);
  if (existsSync(extraResourcePath)) {
    return extraResourcePath;
  }

  const unpackedPath = resolve(`${appPath}.unpacked`, 'runtime', ...parts);
  if (existsSync(unpackedPath)) {
    return unpackedPath;
  }

  const packagedRuntime = resolve(appPath, 'runtime');
  if (existsSync(packagedRuntime)) {
    return resolve(packagedRuntime, ...parts);
  }

  return resolve(appPath, 'desktop', 'runtime', ...parts);
}

module.exports = { resolveRuntimePath };
