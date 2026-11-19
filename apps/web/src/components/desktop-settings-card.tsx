'use client';

import { useEffect, useState } from 'react';
import type { DesktopShellSettings } from '@subscription-tracker/types';
import { getDesktopBridge } from '../lib/desktop-bridge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function DesktopSettingsCard() {
  const [settings, setSettings] = useState<DesktopShellSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const bridge = getDesktopBridge();
    if (!bridge?.getDesktopSettings) {
      return;
    }
    void bridge
      .getDesktopSettings()
      .then(setSettings)
      .catch(() => undefined);
  }, []);

  if (!settings) {
    return null;
  }

  const updateFlag = async (partial: Partial<DesktopShellSettings>) => {
    const bridge = getDesktopBridge();
    if (!bridge?.updateDesktopSettings) return;
    setSaving(true);
    try {
      const updated = await bridge.updateDesktopSettings(partial);
      setSettings(updated);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Desktop background and startup</CardTitle>
        <p className="text-sm text-slate-500">
          Keep scheduled Gmail syncs and renewal notifications active even when
          the main SubSync window is closed.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            disabled={saving}
            checked={settings.minimizeToTray}
            onChange={(e) =>
              void updateFlag({ minimizeToTray: e.target.checked })
            }
          />
          Keep SubSync running in the system tray when closing the window
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            disabled={saving}
            checked={settings.launchAtLogin}
            onChange={(e) =>
              void updateFlag({ launchAtLogin: e.target.checked })
            }
          />
          Launch SubSync automatically when signing in to your computer
        </label>
      </CardContent>
    </Card>
  );
}
