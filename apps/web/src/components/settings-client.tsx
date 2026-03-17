'use client';

import { type FormEvent, useEffect, useState } from 'react';
import type { UserSettings } from '@subscription-tracker/types';
import { getSettings, updateSettings } from '../lib/api';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function SettingsClient() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [leadTimeDays, setLeadTimeDays] = useState('7');
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    void getSettings().then((result) => {
      setSettings(result);
      setLeadTimeDays(String(result.notificationPreference.leadTimeDays));
      setEmailEnabled(result.notificationPreference.channels.includes('email'));
      setPushEnabled(result.notificationPreference.channels.includes('push'));
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const channels = [
        ...(emailEnabled ? (['email'] as const) : []),
        ...(pushEnabled ? (['push'] as const) : []),
      ];

      const updated = await updateSettings({
        leadTimeDays: Number(leadTimeDays),
        channels,
      });

      setSettings(updated);
      setStatusMessage('Preferences saved locally.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">
          Alerts, notification windows, and account tools.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reminder lead time</CardTitle>
          <p className="text-sm text-slate-500">
            Control how far ahead SubSync reminds you about renewals.
          </p>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="text-sm font-medium text-slate-700">
              Days before renewal
              <input
                type="number"
                min="0"
                value={leadTimeDays}
                onChange={(event) => setLeadTimeDays(event.target.value)}
                className="mt-1 w-32 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(event) => setEmailEnabled(event.target.checked)}
                />{' '}
                Email
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={pushEnabled}
                  onChange={(event) => setPushEnabled(event.target.checked)}
                />{' '}
                Push
              </label>
            </div>
            {statusMessage ? <p className="text-sm text-slate-600">{statusMessage}</p> : null}
            <Button className="w-fit" disabled={saving || settings === null}>
              {saving ? 'Saving...' : 'Save preferences'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email forwarding</CardTitle>
          <p className="text-sm text-slate-500">
            Unique alias for capturing Netflix, Disney+, and Hulu invoices.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <code className="block rounded-md bg-slate-900 px-4 py-2 text-sm text-white">
            {settings?.emailForwardingAlias ?? 'subs+general@beacon.app'}
          </code>
          <Button
            variant="outline"
            onClick={() =>
              navigator.clipboard.writeText(
                settings?.emailForwardingAlias ?? 'subs+general@beacon.app',
              )
            }
          >
            Copy alias
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
