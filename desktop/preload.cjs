const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('subsync', {
  getAppVersion: () => ipcRenderer.invoke('subsync:get-app-version'),
  getUpdateStatus: () => ipcRenderer.invoke('subsync:get-update-status'),
  checkForUpdates: () => ipcRenderer.invoke('subsync:check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('subsync:download-update'),
  quitAndInstall: () => ipcRenderer.invoke('subsync:quit-and-install'),
  getDesktopSettings: () => ipcRenderer.invoke('subsync:get-desktop-settings'),
  updateDesktopSettings: (settings) =>
    ipcRenderer.invoke('subsync:update-desktop-settings', settings),
});
