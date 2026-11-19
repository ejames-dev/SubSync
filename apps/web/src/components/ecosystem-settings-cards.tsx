'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import type {
  ExchangeRateEntry,
  UserSettings,
} from '@subscription-tracker/types';
import {
  downloadEncryptedSyncSnapshot,
  getSettings,
  importEncryptedSyncSnapshot,
  listExchangeRates,
  pullEncryptedSyncFolder,
  pushEncryptedSyncFolder,
  refreshExchangeRates,
  sendTestOutboundAlert,
  updateSettings,
  upsertExchangeRate,
} from '../lib/api';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function EcosystemSettingsCards() {
  const [rates, setRates] = useState<ExchangeRateEntry[]>([]);
  const [fxCurrency, setFxCurrency] = useState('EUR');
  const [fxRate, setFxRate] = useState('1.08');
  const [fxMessage, setFxMessage] = useState<string | null>(null);

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpTo, setSmtpTo] = useState('');
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const [syncFolderPath, setSyncFolderPath] = useState('');
  const [syncPassphrase, setSyncPassphrase] = useState('');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listExchangeRates()
      .then(setRates)
      .catch(() => undefined);
    void getSettings()
      .then((s) => {
        setSettings(s);
        setWebhookUrl(s.webhookUrl ?? '');
        setSmtpHost(s.smtp?.host ?? '');
        setSmtpPort(String(s.smtp?.port ?? 465));
        setSmtpUsername(s.smtp?.username ?? '');
        setSmtpFrom(s.smtp?.from ?? '');
        setSmtpTo(s.smtp?.to ?? '');
        setSyncFolderPath(s.syncFolderPath ?? '');
      })
      .catch(() => undefined);
  }, []);

  const handleSaveFxOverride = async () => {
    setBusy(true);
    setFxMessage(null);
    try {
      await upsertExchangeRate(fxCurrency, Number(fxRate));
      setRates(await listExchangeRates());
      setFxMessage(`Saved manual rate for ${fxCurrency.toUpperCase()}.`);
    } catch (err) {
      setFxMessage(err instanceof Error ? err.message : 'Failed to save rate.');
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshFx = async () => {
    setBusy(true);
    setFxMessage(null);
    try {
      const updated = await refreshExchangeRates();
      setRates(updated);
      setFxMessage('Exchange rates refreshed (manual overrides preserved).');
    } catch (err) {
      setFxMessage(
        err instanceof Error ? err.message : 'Failed to refresh exchange rates.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAlertTargets = async () => {
    if (!settings) return;
    setBusy(true);
    setAlertMessage(null);
    try {
      const updated = await updateSettings({
        leadTimeDays: settings.notificationPreference.leadTimeDays,
        channels: settings.notificationPreference.channels,
        monthlyBudgetCents: settings.monthlyBudget
          ? Math.round(settings.monthlyBudget.amount * 100)
          : null,
        budgetCurrency: settings.budgetCurrency,
        webhookUrl: webhookUrl.trim() || null,
        smtpHost: smtpHost.trim() || null,
        smtpPort: smtpHost.trim() ? Number(smtpPort) || 465 : null,
        smtpUsername: smtpUsername.trim() || null,
        ...(smtpPassword.trim() ? { smtpPassword: smtpPassword.trim() } : {}),
        smtpFrom: smtpFrom.trim() || null,
        smtpTo: smtpTo.trim() || null,
      });
      setSettings(updated);
      setSmtpPassword('');
      setAlertMessage('Saved outbound webhook & SMTP configuration.');
    } catch (err) {
      setAlertMessage(
        err instanceof Error ? err.message : 'Could not save alert targets.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleTestAlert = async () => {
    setBusy(true);
    setAlertMessage(null);
    try {
      const res = await sendTestOutboundAlert();
      setAlertMessage(
        `Test alert dispatched — Webhook: ${res.webhookSent ? 'sent' : 'not configured/failed'}, SMTP: ${res.smtpSent ? 'sent' : 'not configured/failed'}.`,
      );
    } catch (err) {
      setAlertMessage(err instanceof Error ? err.message : 'Test alert failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSyncFolder = async () => {
    if (!settings) return;
    setBusy(true);
    setSyncMessage(null);
    try {
      const updated = await updateSettings({
        leadTimeDays: settings.notificationPreference.leadTimeDays,
        channels: settings.notificationPreference.channels,
        monthlyBudgetCents: settings.monthlyBudget
          ? Math.round(settings.monthlyBudget.amount * 100)
          : null,
        budgetCurrency: settings.budgetCurrency,
        syncFolderPath: syncFolderPath.trim() || null,
      });
      setSettings(updated);
      setSyncMessage('Saved sync folder path.');
    } catch (err) {
      setSyncMessage(
        err instanceof Error ? err.message : 'Failed to save sync folder.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handlePushSync = async () => {
    setBusy(true);
    setSyncMessage(null);
    try {
      const res = await pushEncryptedSyncFolder(
        syncPassphrase,
        syncFolderPath.trim() || undefined,
      );
      setSyncMessage(res.message);
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : 'Sync push failed.');
    } finally {
      setBusy(false);
    }
  };

  const handlePullSync = async () => {
    setBusy(true);
    setSyncMessage(null);
    try {
      const res = await pullEncryptedSyncFolder(
        syncPassphrase,
        syncFolderPath.trim() || undefined,
      );
      setSyncMessage(res.message);
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : 'Sync pull failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadEnc = async () => {
    setBusy(true);
    setSyncMessage(null);
    try {
      await downloadEncryptedSyncSnapshot(syncPassphrase);
      setSyncMessage('Downloaded encrypted .subsync.enc snapshot.');
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleImportEncFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setSyncMessage(null);
    try {
      const res = await importEncryptedSyncSnapshot(file, syncPassphrase);
      setSyncMessage(res.message);
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Multi-currency FX normalization</CardTitle>
              <p className="text-sm text-slate-500">
                Offline-cached exchange rates normalize foreign-currency
                subscriptions into your budget currency.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void handleRefreshFx()}
            >
              Refresh FX rates
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium text-slate-700">
              Currency (ISO)
              <input
                type="text"
                maxLength={3}
                value={fxCurrency}
                onChange={(e) => setFxCurrency(e.target.value.toUpperCase())}
                className="mt-1 block w-24 rounded border border-slate-300 px-2.5 py-1.5 text-sm uppercase"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              USD per 1 unit
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                value={fxRate}
                onChange={(e) => setFxRate(e.target.value)}
                className="mt-1 block w-32 rounded border border-slate-300 px-2.5 py-1.5 text-sm"
              />
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void handleSaveFxOverride()}
            >
              Set manual override
            </Button>
          </div>
          {rates.length > 0 ? (
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              {rates.slice(0, 10).map((r) => (
                <span
                  key={r.currency}
                  className="rounded border border-slate-200 px-2 py-1"
                >
                  1 {r.currency} = ${r.rateToUsd.toFixed(4)} USD
                  {r.isManualOverride ? ' (manual)' : ''}
                </span>
              ))}
            </div>
          ) : null}
          {fxMessage ? (
            <p className="text-xs text-slate-600">{fxMessage}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outbound webhook &amp; SMTP alerts</CardTitle>
          <p className="text-sm text-slate-500">
            Deliver renewal and budget alerts to Discord, Slack, ntfy.sh, Home
            Assistant, or your own SMTP server.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block text-xs font-medium text-slate-700">
            Webhook URL (Discord, Slack, ntfy.sh, or JSON endpoint)
            <input
              type="url"
              placeholder="https://ntfy.sh/my-subsync-topic"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-slate-700">
              SMTP host
              <input
                type="text"
                placeholder="smtp.fastmail.com"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              SMTP port
              <input
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Recipient email (To)
              <input
                type="email"
                placeholder="you@example.com"
                value={smtpTo}
                onChange={(e) => setSmtpTo(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              SMTP username
              <input
                type="text"
                value={smtpUsername}
                onChange={(e) => setSmtpUsername(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              SMTP password
              <input
                type="password"
                placeholder={
                  settings?.smtp?.hasPassword ? 'Saved (leave blank to keep)' : ''
                }
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Sender address (From)
              <input
                type="email"
                placeholder="subsync@example.com"
                value={smtpFrom}
                onChange={(e) => setSmtpFrom(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy}
              onClick={() => void handleSaveAlertTargets()}
            >
              Save alert targets
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void handleTestAlert()}
            >
              Send test alert
            </Button>
          </div>
          {alertMessage ? (
            <p className="text-xs text-slate-600">{alertMessage}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Encrypted folder sync (AES-256-GCM)</CardTitle>
          <p className="text-sm text-slate-500">
            Sync an encrypted snapshot across devices via Syncthing, iCloud
            Drive, Dropbox, or Nextcloud without exposing plaintext financial
            data.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-700">
              Local sync folder path
              <input
                type="text"
                placeholder="/Users/you/Sync/SubSync"
                value={syncFolderPath}
                onChange={(e) => setSyncFolderPath(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Encryption passphrase (min 6 chars)
              <input
                type="password"
                placeholder="Required for push / pull / export"
                value={syncPassphrase}
                onChange={(e) => setSyncPassphrase(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void handleSaveSyncFolder()}
            >
              Save folder path
            </Button>
            <Button
              type="button"
              disabled={busy || syncPassphrase.length < 6}
              onClick={() => void handlePushSync()}
            >
              Push to folder
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || syncPassphrase.length < 6}
              onClick={() => void handlePullSync()}
            >
              Pull from folder
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || syncPassphrase.length < 6}
              onClick={() => void handleDownloadEnc()}
            >
              Export .subsync.enc
            </Button>
            <label className="inline-flex cursor-pointer">
              <input
                type="file"
                accept=".enc"
                className="sr-only"
                disabled={busy || syncPassphrase.length < 6}
                onChange={(e) => void handleImportEncFile(e)}
              />
              <Button
                variant="outline"
                disabled={busy || syncPassphrase.length < 6}
                asChild
              >
                <span>Import .subsync.enc</span>
              </Button>
            </label>
          </div>
          {syncMessage ? (
            <p className="text-xs text-slate-600">{syncMessage}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
