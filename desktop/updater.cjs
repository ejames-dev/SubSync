const { app } = require('electron');
const { autoUpdater } = require('electron-updater');

/** @type {import('@subscription-tracker/types').AppUpdateStatus} */
let status = {
  state: 'idle',
  currentVersion: app.getVersion(),
};

let updaterConfigured = false;

function getUpdateStatus() {
  return { ...status, currentVersion: app.getVersion() };
}

function setStatus(patch) {
  status = {
    ...status,
    currentVersion: app.getVersion(),
    ...patch,
  };
}

function setupUpdater() {
  if (!app.isPackaged) {
    setStatus({ state: 'disabled', message: 'Updates are only available in packaged builds.' });
    return;
  }

  if (updaterConfigured) {
    return;
  }

  updaterConfigured = true;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on('checking-for-update', () => {
    setStatus({ state: 'checking', message: undefined, percent: undefined });
  });

  autoUpdater.on('update-available', (info) => {
    setStatus({
      state: 'available',
      availableVersion: info.version,
      message: `SubSync ${info.version} is available.`,
      percent: undefined,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    setStatus({
      state: 'up-to-date',
      availableVersion: info?.version,
      message: 'You are running the latest release.',
      percent: undefined,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    setStatus({
      state: 'downloading',
      percent: progress.percent,
      message: `Downloading update (${Math.round(progress.percent)}%)...`,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    setStatus({
      state: 'downloaded',
      availableVersion: info.version,
      percent: 100,
      message: `SubSync ${info.version} is ready to install.`,
    });
  });

  autoUpdater.on('error', (error) => {
    setStatus({
      state: 'error',
      message: error instanceof Error ? error.message : String(error),
      percent: undefined,
    });
  });
}

async function checkForUpdates() {
  setupUpdater();

  if (!app.isPackaged) {
    return getUpdateStatus();
  }

  try {
    setStatus({ state: 'checking', message: undefined, percent: undefined });
    await autoUpdater.checkForUpdates();
  } catch (error) {
    setStatus({
      state: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return getUpdateStatus();
}

async function downloadUpdate() {
  setupUpdater();

  if (!app.isPackaged) {
    return getUpdateStatus();
  }

  if (status.state !== 'available' && status.state !== 'downloading') {
    throw new Error('No update is available to download.');
  }

  try {
    setStatus({ state: 'downloading', percent: 0, message: 'Starting download...' });
    await autoUpdater.downloadUpdate();
  } catch (error) {
    setStatus({
      state: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return getUpdateStatus();
}

function quitAndInstall() {
  setupUpdater();

  if (!app.isPackaged || status.state !== 'downloaded') {
    throw new Error('No downloaded update is ready to install.');
  }

  autoUpdater.quitAndInstall();
}

module.exports = {
  setupUpdater,
  getUpdateStatus,
  checkForUpdates,
  downloadUpdate,
  quitAndInstall,
};
