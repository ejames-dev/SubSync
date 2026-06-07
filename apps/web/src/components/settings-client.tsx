'use client';

import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import type { DataBackupInfo, UserSettings } from '@subscription-tracker/types';
import {
  createDatabaseBackup,
  downloadDatabaseBackup,
  downloadSubscriptionExport,
  getSettings,
  listDatabaseBackups,
  restoreDatabaseBackup,
  restoreStoredDatabaseBackup,
  updateSettings,
} from '../lib/api';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function SettingsClient() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [leadTimeDays, setLeadTimeDays] = useState('7');
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backups, setBackups] = useState<DataBackupInfo[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function refreshBackups() {
    const items = await listDatabaseBackups();
    setBackups(items);
    return items;
  }

  useEffect(() => {
    void getSettings().then((result) => {
      setSettings(result);
      setLeadTimeDays(String(result.notificationPreference.leadTimeDays));
      setEmailEnabled(result.notificationPreference.channels.includes('email'));
      setPushEnabled(result.notificationPreference.channels.includes('push'));
    });
    void refreshBackups().catch(() => undefined);
  }, []);

  async function handleExport(format: 'csv' | 'json') {
    setExporting(format);
    setStatusMessage(null);
    try {
      await downloadSubscriptionExport(format);
      setStatusMessage(`Exported subscriptions as ${format.toUpperCase()}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      setExporting(null);
    }
  }

  async function handleCreateBackup() {
    setBackingUp(true);
    setStatusMessage(null);
    try {
      const backup = await createDatabaseBackup();
      await refreshBackups();
      await downloadDatabaseBackup(backup.fileName);
      setStatusMessage(`Backup saved as ${backup.fileName}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Backup failed.');
    } finally {
      setBackingUp(false);
    }
  }

  async function handleRestoreUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setRestoring(true);
    setStatusMessage(null);
    try {
      const result = await restoreDatabaseBackup(file);
      await refreshBackups();
      setStatusMessage(result.message);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Restore failed.');
    } finally {
      setRestoring(false);
    }
  }

  async function handleRestoreStored(fileName: string) {
    setRestoring(true);
    setStatusMessage(null);
    try {
      const result = await restoreStoredDatabaseBackup(fileName);
      await refreshBackups();
      setStatusMessage(result.message);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Restore failed.');
    } finally {
      setRestoring(false);
    }
  }

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
          <CardTitle>Export subscriptions</CardTitle>
          <p className="text-sm text-slate-500">
            Download your subscription list as CSV or JSON for spreadsheets, migration, or
            safekeeping.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={exporting !== null}
            onClick={() => void handleExport('csv')}
          >
            {exporting === 'csv' ? 'Exporting...' : 'Export CSV'}
          </Button>
          <Button
            variant="outline"
            disabled={exporting !== null}
            onClick={() => void handleExport('json')}
          >
            {exporting === 'json' ? 'Exporting...' : 'Export JSON'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup and restore</CardTitle>
          <p className="text-sm text-slate-500">
            Create a full SQLite backup of your local SubSync data or restore from a backup
            file. Restoring automatically saves a safety copy of your current database first.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button disabled={backingUp || restoring} onClick={() => void handleCreateBackup()}>
              {backingUp ? 'Creating backup...' : 'Create backup'}
            </Button>
            <label className="inline-flex">
              <input
                type="file"
                accept=".db,application/octet-stream"
                className="hidden"
                disabled={restoring}
                onChange={(event) => void handleRestoreUpload(event)}
              />
              <Button variant="outline" disabled={restoring} asChild>
                <span>{restoring ? 'Restoring...' : 'Restore from file'}</span>
              </Button>
            </label>
          </div>
          {backups.length ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Local backups</p>
              <ul className="space-y-2 text-sm text-slate-600">
                {backups.map((backup) => (
                  <li
                    key={backup.fileName}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2"
                  >
                    <div>
                      <p className="font-medium text-slate-800">{backup.fileName}</p>
                      <p>
                        {new Date(backup.createdAt).toLocaleString()} ·{' '}
                        {Math.max(1, Math.round(backup.sizeBytes / 1024))} KB
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void downloadDatabaseBackup(backup.fileName)}
                      >
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={restoring}
                        onClick={() => void handleRestoreStored(backup.fileName)}
                      >
                        Restore
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No local backups yet.</p>
          )}
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
