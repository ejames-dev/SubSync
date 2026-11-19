const {
  app,
  BrowserWindow,
  dialog,
  Menu,
  nativeImage,
  Notification,
  ipcMain,
  safeStorage,
  shell,
  Tray,
} = require('electron');
const { randomBytes } = require('node:crypto');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const net = require('node:net');
const {
  buildTrayTooltipSummary,
  readDesktopPreferences,
  resolveNotificationTargetUrl,
  writeDesktopPreferences,
} = require('./desktop-shell.cjs');
const { applyMigrations } = require('./migrations.cjs');
const { resolveRuntimePath } = require('./runtime-path.cjs');
const { getServerStatus } = require('./server-readiness.cjs');
const {
  setupUpdater,
  getUpdateStatus,
  checkForUpdates,
  downloadUpdate,
  quitAndInstall,
} = require('./updater.cjs');

const API_PORT = 43100;
const WEB_PORT = 43101;
const HOST = '127.0.0.1';
const STARTUP_TIMEOUT_MS = 15000;

let mainWindow = null;
let tray = null;
let isQuitting = false;
let runtimeReady = false;
let notificationPollTimer = null;
const baseWebOrigin = `http://${HOST}:${WEB_PORT}`;
let startupUrl = `${baseWebOrigin}/dashboard`;

if (process.platform === 'win32') {
  app.setAppUserModelId('com.evannewman.subsync');
}

function getRuntimePath(...parts) {
  return resolveRuntimePath(app.getAppPath(), process.resourcesPath, ...parts);
}

function getDesktopPreferencesPath() {
  return resolve(app.getPath('userData'), 'data', 'desktop-preferences.json');
}

function getDesktopSettings() {
  const stored = readDesktopPreferences(getDesktopPreferencesPath());
  try {
    const loginState = app.getLoginItemSettings?.();
    if (typeof loginState?.openAtLogin === 'boolean') {
      return {
        ...stored,
        launchAtLogin: loginState.openAtLogin,
      };
    }
  } catch {
    // Ignore login-item inspection errors in unpackaged/headless environments.
  }
  return stored;
}

function applyDesktopSettings(partial) {
  const next = writeDesktopPreferences(getDesktopPreferencesPath(), partial);
  if (typeof partial?.launchAtLogin === 'boolean') {
    try {
      app.setLoginItemSettings?.({ openAtLogin: next.launchAtLogin });
    } catch {
      // Ignore unsupported login-item registration in dev/Linux environments.
    }
  }
  refreshTrayMenu();
  return getDesktopSettings();
}

function getPreloadPath() {
  const appPath = app.getAppPath();
  const packagedPreload = resolve(appPath, 'preload.cjs');

  if (existsSync(packagedPreload)) {
    return packagedPreload;
  }

  return resolve(appPath, 'desktop', 'preload.cjs');
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

  return applyMigrations(databasePath, migrationsDir);
}

function ensureOAuthEncryptionKey() {
  if (process.env.OAUTH_TOKEN_ENCRYPTION_KEY?.trim()) {
    return process.env.OAUTH_TOKEN_ENCRYPTION_KEY.trim();
  }

  const dataDir = resolve(app.getPath('userData'), 'data');
  mkdirSync(dataDir, { recursive: true });
  const keyFilePath = resolve(dataDir, 'oauth-token-key.bin');

  try {
    if (existsSync(keyFilePath)) {
      const stored = readFileSync(keyFilePath);
      if (safeStorage?.isEncryptionAvailable?.()) {
        return safeStorage.decryptString(stored);
      }
      const raw = stored.toString('utf8').trim();
      if (Buffer.from(raw, 'base64').length === 32) {
        return raw;
      }
    }
  } catch {
    // Regenerate key if reading or decrypting fails.
  }

  const generated = randomBytes(32).toString('base64');
  try {
    if (safeStorage?.isEncryptionAvailable?.()) {
      writeFileSync(keyFilePath, safeStorage.encryptString(generated), {
        mode: 0o600,
      });
    } else {
      writeFileSync(keyFilePath, generated, { encoding: 'utf8', mode: 0o600 });
    }
  } catch {
    // Ephemeral fallback if userData is not writable.
  }

  return generated;
}

function isAllowedExternalUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isAllowedInAppUrl(rawUrl) {
  if (rawUrl.startsWith('data:text/html,')) {
    return true;
  }
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.origin === `http://${HOST}:${WEB_PORT}` ||
      parsed.origin === `http://localhost:${WEB_PORT}` ||
      (parsed.origin === `http://${HOST}:${API_PORT}` &&
        parsed.pathname.startsWith('/api/gmail/callback'))
    );
  } catch {
    return false;
  }
}

function startApi(databasePath) {
  process.env.HOST = HOST;
  process.env.API_PORT = String(API_PORT);
  process.env.DATABASE_URL = toSqliteUrl(databasePath);
  process.env.CORS_ORIGIN =
    process.env.CORS_ORIGIN ||
    `http://${HOST}:${WEB_PORT},http://localhost:${WEB_PORT},http://${HOST}:3000,http://localhost:3000`;
  process.env.OAUTH_TOKEN_ENCRYPTION_KEY = ensureOAuthEncryptionKey();
  require(getRuntimePath('api', 'dist', 'main.js'));
}

function startWeb() {
  process.env.NODE_ENV = 'production';
  process.env.HOSTNAME = HOST;
  process.env.PORT = String(WEB_PORT);
  require(getRuntimePath('web', 'apps', 'web', 'server.js'));
}

function openTargetUrl(targetUrl) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow(runtimeReady ? targetUrl : undefined);
  } else {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    if (runtimeReady && targetUrl) {
      void mainWindow.loadURL(targetUrl);
    }
  }
}

function createTray() {
  if (tray) {
    return;
  }
  try {
    const iconPath = getIconPath();
    const icon = existsSync(iconPath)
      ? nativeImage.createFromPath(iconPath)
      : nativeImage.createEmpty();
    tray = new Tray(icon);
    tray.setToolTip('SubSync — Local Subscription Command Center');
    tray.on('click', () => {
      openTargetUrl(startupUrl);
    });
    refreshTrayMenu();
  } catch {
    tray = null;
  }
}

function refreshTrayMenu(summaryText) {
  if (!tray) {
    return;
  }
  const prefs = getDesktopSettings();
  const statusLabel = summaryText || 'Background sync & reminders active';
  const contextMenu = Menu.buildFromTemplate([
    { label: statusLabel, enabled: false },
    { type: 'separator' },
    {
      label: 'Open Dashboard',
      click: () => openTargetUrl(`${baseWebOrigin}/dashboard`),
    },
    {
      label: 'Open Renewal Calendar',
      click: () => openTargetUrl(`${baseWebOrigin}/calendar`),
    },
    { type: 'separator' },
    {
      label: 'Keep running in tray on close',
      type: 'checkbox',
      checked: prefs.minimizeToTray,
      click: (menuItem) => {
        applyDesktopSettings({ minimizeToTray: menuItem.checked });
      },
    },
    {
      label: 'Launch at OS login',
      type: 'checkbox',
      checked: prefs.launchAtLogin,
      click: (menuItem) => {
        applyDesktopSettings({ launchAtLogin: menuItem.checked });
      },
    },
    { type: 'separator' },
    {
      label: 'Quit SubSync',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
}

function createWindow(initialTargetUrl) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#f8fafc',
    icon: process.platform === 'win32' ? getIconPath() : undefined,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: getPreloadPath(),
    },
  });

  mainWindow.on('close', (event) => {
    const prefs = getDesktopSettings();
    if (!isQuitting && prefs.minimizeToTray && tray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedInAppUrl(url)) {
      event.preventDefault();
      if (isAllowedExternalUrl(url)) {
        void shell.openExternal(url);
      }
    }
  });

  if (initialTargetUrl) {
    void mainWindow.loadURL(initialTargetUrl);
    return;
  }

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
    server.on('error', () => {
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
      const status = await getServerStatus(url);
      if (status >= 200 && status < 300) {
        return;
      }
      lastError = new Error(`${label} responded with ${status}`);
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

async function refreshTraySummaryFromApi() {
  if (!tray) {
    return;
  }
  try {
    const response = await fetch(
      `http://${HOST}:${API_PORT}/api/dashboard/summary`,
    );
    if (!response.ok) {
      return;
    }
    const summary = await response.json();
    const tooltip = buildTrayTooltipSummary(summary);
    tray.setToolTip(tooltip);
    refreshTrayMenu(tooltip);
  } catch {
    // Ignore transient summary errors.
  }
}

async function pollRenewalNotifications() {
  try {
    const response = await fetch(
      `http://${HOST}:${API_PORT}/api/notifications/claim?channel=push`,
      { method: 'POST' },
    );
    if (!response.ok) {
      return;
    }

    const claimed = await response.json();
    for (const item of claimed) {
      if (Notification.isSupported()) {
        const notification = new Notification({
          title: item.title,
          body: item.body,
        });
        const targetUrl = resolveNotificationTargetUrl(baseWebOrigin, item);
        notification.on('click', () => {
          openTargetUrl(targetUrl);
        });
        notification.show();
      }
    }
    await refreshTraySummaryFromApi();
  } catch {
    // Ignore transient API errors during startup or shutdown.
  }
}

function startNotificationPolling() {
  if (notificationPollTimer) {
    return;
  }

  void pollRenewalNotifications();
  notificationPollTimer = setInterval(() => {
    void pollRenewalNotifications();
  }, 60_000);
}

function stopNotificationPolling() {
  if (!notificationPollTimer) {
    return;
  }

  clearInterval(notificationPollTimer);
  notificationPollTimer = null;
}

async function initializeDesktopRuntime() {
  await assertPortAvailable(API_PORT, 'API');
  await assertPortAvailable(WEB_PORT, 'Web UI');
  const databasePath = ensureLocalDatabase();
  startApi(databasePath);
  await waitForServer(`http://${HOST}:${API_PORT}/api/services`, 'API');
  startWeb();
  await waitForServer(startupUrl, 'Web UI');
  runtimeReady = true;
  startNotificationPolling();
  if (mainWindow && !mainWindow.isDestroyed()) {
    await mainWindow.loadURL(startupUrl);
  }
}

function registerDesktopBridge() {
  ipcMain.handle('subsync:get-app-version', () => app.getVersion());
  ipcMain.handle('subsync:get-update-status', () => getUpdateStatus());
  ipcMain.handle('subsync:check-for-updates', () => checkForUpdates());
  ipcMain.handle('subsync:download-update', () => downloadUpdate());
  ipcMain.handle('subsync:quit-and-install', () => {
    isQuitting = true;
    quitAndInstall();
  });
  ipcMain.handle('subsync:get-desktop-settings', () => getDesktopSettings());
  ipcMain.handle('subsync:update-desktop-settings', (_event, partial) =>
    applyDesktopSettings(partial),
  );
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
}

app.on('second-instance', () => {
  openTargetUrl(startupUrl);
});

app.on('before-quit', () => {
  isQuitting = true;
  stopNotificationPolling();
});

app.whenReady().then(() => {
  try {
    registerDesktopBridge();
    setupUpdater();
    const initialSettings = getDesktopSettings();
    if (initialSettings.launchAtLogin) {
      try {
        app.setLoginItemSettings?.({ openAtLogin: true });
      } catch {
        // Ignore on unsupported environments.
      }
    }
    createTray();
    createWindow();
    void initializeDesktopRuntime().catch((error) => {
      dialog.showErrorBox(
        'SubSync failed to start',
        error instanceof Error ? error.stack ?? error.message : String(error),
      );
      isQuitting = true;
      app.quit();
    });
  } catch (error) {
    dialog.showErrorBox(
      'SubSync failed to initialize',
      error instanceof Error ? error.stack ?? error.message : String(error),
    );
    isQuitting = true;
    app.quit();
  }
});

app.on('window-all-closed', () => {
  const prefs = getDesktopSettings();
  if (!isQuitting && prefs.minimizeToTray && tray) {
    return;
  }
  if (process.platform !== 'darwin') {
    stopNotificationPolling();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow(runtimeReady ? startupUrl : undefined);
  } else {
    openTargetUrl();
  }
});
