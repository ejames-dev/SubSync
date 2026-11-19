import type {
  AppUpdateStatus,
  DesktopShellSettings,
} from '@subscription-tracker/types';

export type DesktopBridge = {
  getAppVersion: () => Promise<string>;
  getUpdateStatus: () => Promise<AppUpdateStatus>;
  checkForUpdates: () => Promise<AppUpdateStatus>;
  downloadUpdate: () => Promise<AppUpdateStatus>;
  quitAndInstall: () => Promise<void>;
  getDesktopSettings?: () => Promise<DesktopShellSettings>;
  updateDesktopSettings?: (
    /* eslint-disable-next-line no-unused-vars */
    settings: Partial<DesktopShellSettings>,
  ) => Promise<DesktopShellSettings>;
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
