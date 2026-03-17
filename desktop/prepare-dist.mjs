import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import rootPackageJson from '../package.json' with { type: 'json' };

const rootDir = resolve(import.meta.dirname, '..');
const appDir = resolve(rootDir, 'desktop', 'app');
const runtimeDir = resolve(appDir, 'runtime');
const copyTargets = [
  {
    from: resolve(rootDir, 'apps', 'api', 'dist'),
    to: resolve(runtimeDir, 'api', 'dist'),
  },
  {
    from: resolve(rootDir, 'apps', 'api', 'prisma', 'generated'),
    to: resolve(runtimeDir, 'api', 'prisma', 'generated'),
  },
  {
    from: resolve(rootDir, 'apps', 'api', 'prisma', 'migrations'),
    to: resolve(runtimeDir, 'api', 'prisma', 'migrations'),
  },
  {
    from: resolve(rootDir, 'apps', 'web', '.next', 'standalone'),
    to: resolve(runtimeDir, 'web'),
  },
  {
    from: resolve(rootDir, 'apps', 'web', '.next', 'static'),
    to: resolve(runtimeDir, 'web', 'apps', 'web', '.next', 'static'),
  },
  {
    from: resolve(rootDir, 'apps', 'web', 'public'),
    to: resolve(runtimeDir, 'web', 'apps', 'web', 'public'),
  },
];

rmSync(appDir, {
  force: true,
  recursive: true,
  maxRetries: 5,
  retryDelay: 250,
});
mkdirSync(runtimeDir, { recursive: true });

for (const target of copyTargets) {
  if (!existsSync(target.from)) {
    throw new Error(`Missing build artifact: ${target.from}`);
  }

  mkdirSync(resolve(target.to, '..'), { recursive: true });
  cpSync(target.from, target.to, { recursive: true });
}

copyFileSync(resolve(rootDir, 'desktop', 'main.cjs'), resolve(appDir, 'main.cjs'));
copyFileSync(
  resolve(rootDir, 'apps', 'web', 'src', 'app', 'favicon.ico'),
  resolve(appDir, 'icon.ico'),
);

writeFileSync(
  resolve(appDir, 'package.json'),
  JSON.stringify(
    {
      name: 'subsync-desktop',
      version: rootPackageJson.version,
      private: true,
      main: 'main.cjs',
      description: rootPackageJson.description,
      author: rootPackageJson.author,
      dependencies: rootPackageJson.dependencies,
      overrides: rootPackageJson.overrides,
    },
    null,
    2,
  ),
);

if (process.platform === 'win32') {
  execFileSync(
    process.env.ComSpec ?? 'cmd.exe',
    ['/d', '/s', '/c', 'npm install --omit=dev --no-package-lock'],
    {
      cwd: appDir,
      stdio: 'inherit',
    },
  );
  execFileSync(
    process.env.ComSpec ?? 'cmd.exe',
    ['/d', '/s', '/c', 'npm dedupe'],
    {
      cwd: appDir,
      stdio: 'inherit',
    },
  );
} else {
  execFileSync('npm', ['install', '--omit=dev', '--no-package-lock'], {
    cwd: appDir,
    stdio: 'inherit',
  });
  execFileSync('npm', ['dedupe'], {
    cwd: appDir,
    stdio: 'inherit',
  });
}

console.log(`Prepared desktop runtime in ${appDir}`);
