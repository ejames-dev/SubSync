import type { AppUpdateStatus } from '@subscription-tracker/types';

export type DesktopBridge = {
  getAppVersion: () => Promise<string>;
  getUpdateStatus: () => Promise<AppUpdateStatus>;
  checkForUpdates: () => Promise<AppUpdateStatus>;
  downloadUpdate: () => Promise<AppUpdateStatus>;
  quitAndInstall: () => Promise<void>;
};

type WindowWithDesktopBridge = Window & {
  subsync?: DesktopBridge;
};

export function getDesktopBridge(): DesktopBridge | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return (window as WindowWithDesktopBridge).subsync;
}
