'use client';

import { useEffect, useState } from 'react';
import type { AppUpdateStatus } from '@subscription-tracker/types';
import { getDesktopBridge } from '../lib/desktop-bridge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function DesktopUpdateCard() {
  const bridge = getDesktopBridge();
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!bridge) {
      return;
    }

    void bridge.getUpdateStatus().then(setUpdateStatus);
  }, [bridge]);

  if (!bridge) {
    return null;
  }

  async function runUpdateAction(action: () => Promise<AppUpdateStatus | void>) {
    setBusy(true);
    try {
      const result = await action();
      if (result) {
        setUpdateStatus(result);
      }
    } finally {
      setBusy(false);
    }
  }

  const currentVersion = updateStatus?.currentVersion ?? '…';
  const message =
    updateStatus?.message ??
    (updateStatus?.state === 'disabled'
      ? 'Updates are checked from packaged desktop builds.'
      : 'Check GitHub Releases for the latest portable build.');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Desktop updates</CardTitle>
        <p className="text-sm text-slate-500">
          Installed version: <span className="font-medium text-slate-800">{currentVersion}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">{message}</p>
        {updateStatus?.state === 'downloading' && updateStatus.percent !== undefined ? (
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${Math.min(100, Math.max(0, updateStatus.percent))}%` }}
            />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={busy || updateStatus?.state === 'checking'}
            onClick={() => void runUpdateAction(() => bridge.checkForUpdates())}
          >
            {updateStatus?.state === 'checking' ? 'Checking...' : 'Check for updates'}
          </Button>
          {updateStatus?.state === 'available' ? (
            <Button
              disabled={busy}
              onClick={() => void runUpdateAction(() => bridge.downloadUpdate())}
            >
              Download update
            </Button>
          ) : null}
          {updateStatus?.state === 'downloaded' ? (
            <Button
              disabled={busy}
              onClick={() => void runUpdateAction(() => bridge.quitAndInstall())}
            >
              Restart to update
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
