const { app, BrowserWindow, dialog } = require('electron');
const {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} = require('node:fs');
const { resolve, dirname } = require('node:path');
const net = require('node:net');
const { DatabaseSync } = require('node:sqlite');

const API_PORT = 43100;
const WEB_PORT = 43101;
const HOST = '127.0.0.1';
const STARTUP_TIMEOUT_MS = 15000;

let mainWindow = null;
let startupUrl = `http://${HOST}:${WEB_PORT}/dashboard`;

function getRuntimePath(...parts) {
  const appPath = app.getAppPath();
  const packagedRuntime = resolve(appPath, 'runtime');

  if (existsSync(packagedRuntime)) {
    return resolve(packagedRuntime, ...parts);
  }

  return resolve(appPath, 'desktop', 'runtime', ...parts);
}

function getIconPath() {
  const appPath = app.getAppPath();
  const packagedIcon = resolve(appPath, 'icon.ico');

  if (existsSync(packagedIcon)) {
    return packagedIcon;
  }

  return resolve(appPath, 'apps', 'web', 'src', 'app', 'favicon.ico');
}

function toSqliteUrl(filePath) {
  return `file:${filePath.replace(/\\/g, '/')}`;
}

function ensureLocalDatabase() {
  const dataDir = resolve(app.getPath('userData'), 'data');
  const databasePath = resolve(dataDir, 'subsync.db');
  const migrationsDir = getRuntimePath('api', 'prisma', 'migrations');

  mkdirSync(dataDir, { recursive: true });

  if (!existsSync(migrationsDir)) {
    throw new Error(`Missing SQLite migrations at ${migrationsDir}`);
  }

  const migrationFiles = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(migrationsDir, entry.name, 'migration.sql'))
    .filter((migrationPath) => existsSync(migrationPath))
    .sort();

  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA foreign_keys = ON;');

  for (const migrationFile of migrationFiles) {
    db.exec(readFileSync(migrationFile, 'utf8'));
  }

  db.close();

  return databasePath;
}

function startApi(databasePath) {
  process.env.HOST = HOST;
  process.env.API_PORT = String(API_PORT);
  process.env.DATABASE_URL = toSqliteUrl(databasePath);
  require(getRuntimePath('api', 'dist', 'src', 'main.js'));
}

function startWeb() {
  process.env.NODE_ENV = 'production';
  process.env.HOSTNAME = HOST;
  process.env.PORT = String(WEB_PORT);
  require(getRuntimePath('web', 'apps', 'web', 'server.js'));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#f8fafc',
    icon: getIconPath(),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.loadURL(
    `data:text/html,${encodeURIComponent(`
      <html>
        <body style="font-family:Segoe UI,sans-serif;background:#f8fafc;color:#0f172a;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="text-align:center">
            <h1 style="margin-bottom:12px">Starting SubSync</h1>
            <p style="margin:0;color:#475569">Preparing local services and database...</p>
          </div>
        </body>
      </html>
    `)}`,
  );
}

function assertPortAvailable(port, label) {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = net.createServer();
    server.unref();
    server.on('error', (error) => {
      rejectPromise(
        new Error(
          `${label} port ${port} is already in use. Close the conflicting process and launch SubSync again.`,
        ),
      );
    });
    server.listen(port, HOST, () => {
      server.close(() => resolvePromise());
    });
  });
}

async function waitForServer(url, label) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`${label} responded with ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  }

  throw new Error(
    `${label} did not become ready in time. ${
      lastError instanceof Error ? lastError.message : 'Unknown startup failure.'
    }`,
  );
}

async function initializeDesktopRuntime() {
  await assertPortAvailable(API_PORT, 'API');
  await assertPortAvailable(WEB_PORT, 'Web UI');
  const databasePath = ensureLocalDatabase();
  startApi(databasePath);
  await waitForServer(`http://${HOST}:${API_PORT}/api/services`, 'API');
  startWeb();
  await waitForServer(startupUrl, 'Web UI');
  if (mainWindow) {
    await mainWindow.loadURL(startupUrl);
  }
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
}

app.on('second-instance', () => {
  if (!mainWindow) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
});

app.whenReady().then(() => {
  try {
    createWindow();
    void initializeDesktopRuntime().catch((error) => {
      dialog.showErrorBox(
        'SubSync failed to start',
        error instanceof Error ? error.stack ?? error.message : String(error),
      );
      app.quit();
    });
  } catch (error) {
    dialog.showErrorBox(
      'SubSync failed to initialize',
      error instanceof Error ? error.stack ?? error.message : String(error),
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
