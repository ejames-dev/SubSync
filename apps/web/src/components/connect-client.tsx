'use client';

import { useEffect, useState, type ChangeEvent, type DragEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type {
  GmailConnectionStatus,
  ImapConnectionStatus,
  IntegrationConnection,
  ServiceProvider,
  UserSettings,
} from '@subscription-tracker/types';
import {
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Mail,
  PlugZap,
  RefreshCw,
  Server,
} from 'lucide-react';
import {
  connectImap,
  connectIntegration,
  disconnectGmail,
  disconnectImap,
  disconnectIntegration,
  getGmailAuthUrl,
  getGmailStatus,
  getImapStatus,
  getSettings,
  ingestBankCsvFile,
  ingestEmail,
  ingestEmlFile,
  listIntegrations,
  listServices,
  syncGmailBillingEmails,
  syncImapBillingEmails,
} from '../lib/api';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

type ConnectionState = Record<
  string,
  'idle' | 'pending' | 'connected' | 'manual'
>;
type EmailDraft = {
  sender: string;
  subject: string;
  body: string;
};

export function ConnectClient() {
  const searchParams = useSearchParams();
  const [services, setServices] = useState<ServiceProvider[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>({});
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [gmailStatus, setGmailStatus] = useState<GmailConnectionStatus | null>(
    null,
  );
  const [imapStatus, setImapStatus] = useState<ImapConnectionStatus | null>(
    null,
  );
  const [imapForm, setImapForm] = useState({
    host: '',
    port: '993',
    tls: true,
    username: '',
    password: '',
    mailbox: 'INBOX',
  });
  const [showImapForm, setShowImapForm] = useState(false);
  const [busyImap, setBusyImap] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [emailDraft, setEmailDraft] = useState<EmailDraft>({
    sender: 'billing@netflix.com',
    subject: 'Netflix Standard plan renews Apr 16, 2026',
    body: 'Amount: $15.49 billed monthly to card ending in 4242',
  });
  const [importingEmail, setImportingEmail] = useState(false);
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [syncingGmail, setSyncingGmail] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function refreshGmailStatus() {
    const status = await getGmailStatus();
    setGmailStatus(status);
    return status;
  }

  useEffect(() => {
    void Promise.all([
      listServices(),
      listIntegrations(),
      getSettings(),
      getGmailStatus(),
      getImapStatus().catch(() => ({ connected: false })),
    ]).then(([serviceData, connections, currentSettings, gmail, imap]) => {
      setServices(serviceData);
      setSettings(currentSettings);
      setGmailStatus(gmail);
      setImapStatus(imap);
      setConnectionState(buildConnectionState(serviceData, connections));
    });
  }, []);

  useEffect(() => {
    const gmailResult = searchParams.get('gmail');
    if (!gmailResult) {
      return;
    }

    if (gmailResult === 'connected') {
      const email = searchParams.get('email');
      void refreshGmailStatus().then(() => {
        setStatusMessage(
          email
            ? `Gmail connected as ${email}. Billing emails will sync automatically.`
            : 'Gmail connected. Billing emails will sync automatically.',
        );
      });
      return;
    }

    if (gmailResult === 'error') {
      setStatusMessage(
        searchParams.get('message') ?? 'Gmail authorization failed.',
      );
    }
  }, [searchParams]);

  async function handleConnect(service: ServiceProvider) {
    setStatusMessage(null);
    setConnectionState((current) => ({ ...current, [service.id]: 'pending' }));

    try {
      const result = await connectIntegration(service.id, {
        source: service.supportsOAuth ? 'oauth' : 'email',
      });
      setConnectionState((current) => ({
        ...current,
        [service.id]: result.connection.status,
      }));
      setStatusMessage(result.message);
    } catch (error) {
      setConnectionState((current) => ({ ...current, [service.id]: 'idle' }));
      setStatusMessage(
        error instanceof Error ? error.message : 'Connection failed.',
      );
    }
  }

  async function handleConnectGmail() {
    setConnectingGmail(true);
    setStatusMessage(null);
    try {
      const { authUrl } = await getGmailAuthUrl();
      window.open(authUrl, '_blank', 'noopener,noreferrer');
      setStatusMessage(
        'Complete Gmail authorization in your browser, then return here.',
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Failed to start Gmail OAuth.',
      );
    } finally {
      setConnectingGmail(false);
    }
  }

  async function handleDisconnectGmail() {
    setStatusMessage(null);
    try {
      const status = await disconnectGmail();
      setGmailStatus(status);
      setStatusMessage('Gmail disconnected.');
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Failed to disconnect Gmail.',
      );
    }
  }

  async function handleSyncGmail() {
    setSyncingGmail(true);
    setStatusMessage(null);
    try {
      const result = await syncGmailBillingEmails();
      await refreshGmailStatus();
      setStatusMessage(
        `Gmail sync complete: imported ${result.imported}, review ${result.review}, skipped ${result.skipped}, failed ${result.failed}.`,
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Gmail sync failed.',
      );
    } finally {
      setSyncingGmail(false);
    }
  }

  async function handleConnectImap() {
    setBusyImap(true);
    setStatusMessage(null);
    try {
      const status = await connectImap({
        host: imapForm.host,
        port: Number(imapForm.port) || 993,
        tls: imapForm.tls,
        username: imapForm.username,
        password: imapForm.password,
        mailbox: imapForm.mailbox || 'INBOX',
      });
      setImapStatus(status);
      setShowImapForm(false);
      setImapForm((prev) => ({ ...prev, password: '' }));
      setStatusMessage(`Connected IMAP mailbox ${status.username}@${status.host}.`);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'IMAP connection failed.',
      );
    } finally {
      setBusyImap(false);
    }
  }

  async function handleSyncImap() {
    setBusyImap(true);
    setStatusMessage(null);
    try {
      const result = await syncImapBillingEmails();
      setImapStatus(await getImapStatus());
      setStatusMessage(
        `IMAP sync complete: scanned ${result.scanned}, imported ${result.imported}, review ${result.review}, skipped ${result.skipped}.`,
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'IMAP sync failed.',
      );
    } finally {
      setBusyImap(false);
    }
  }

  async function handleDisconnectImap() {
    setBusyImap(true);
    setStatusMessage(null);
    try {
      const status = await disconnectImap();
      setImapStatus(status);
      setStatusMessage('IMAP mailbox disconnected.');
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Failed to disconnect IMAP.',
      );
    } finally {
      setBusyImap(false);
    }
  }

  async function processEmlFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingFile(true);
    setStatusMessage(null);
    try {
      let imported = 0;
      let review = 0;
      for (const file of Array.from(files)) {
        const res = await ingestEmlFile(file);
        if (res.status === 'created' || res.status === 'updated') imported += 1;
        if (res.status === 'review' || res.status === 'mixed') review += 1;
      }
      setStatusMessage(
        `Processed ${files.length} .eml file${files.length === 1 ? '' : 's'}: ${imported} imported, ${review} queued for review.`,
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'EML upload failed.',
      );
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleEmlInput(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    await processEmlFiles(files);
    event.target.value = '';
  }

  async function handleEmlDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    await processEmlFiles(event.dataTransfer.files);
  }

  async function handleBankCsvInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadingFile(true);
    setStatusMessage(null);
    try {
      const res = await ingestBankCsvFile(
        file,
        settings?.budgetCurrency || 'USD',
      );
      setStatusMessage(res.message);
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : 'Bank statement CSV analysis failed.',
      );
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleDisconnect(service: ServiceProvider) {
    setStatusMessage(null);
    setConnectionState((current) => ({ ...current, [service.id]: 'pending' }));

    try {
      const result = await disconnectIntegration(service.id);
      setConnectionState((current) => ({
        ...current,
        [service.id]: service.supportsOAuth ? 'idle' : 'manual',
      }));
      setStatusMessage(result.message);
    } catch (error) {
      setConnectionState((current) => ({
        ...current,
        [service.id]: 'connected',
      }));
      setStatusMessage(
        error instanceof Error ? error.message : 'Disconnect failed.',
      );
    }
  }

  async function handleEmailImport() {
    setImportingEmail(true);
    setStatusMessage(null);
    try {
      const result = await ingestEmail({
        ...emailDraft,
        receivedAt: new Date().toISOString(),
      });
      const importedSubscription = result.subscription;
      if (importedSubscription) {
        setConnectionState((current) => ({
          ...current,
          [importedSubscription.serviceId]:
            importedSubscription.autoImportSource === 'email'
              ? 'manual'
              : 'connected',
        }));
      }
      setStatusMessage(result.message);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Email import failed.',
      );
    } finally {
      setImportingEmail(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Connections</h1>
        <p className="text-sm text-slate-500">
          Sync receipts from Gmail or IMAP, drop .eml invoices, or scan a local
          bank CSV statement without third-party aggregators.
        </p>
      </div>
      {statusMessage ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700">
          <span>{statusMessage}</span>
          <Link
            href="/imports/review"
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            Open import review queue &rarr;
          </Link>
        </div>
      ) : null}
      <Card className="border-sky-200 bg-sky-50/40 dark:border-sky-900 dark:bg-sky-950/20">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Mail className="h-8 w-8 text-sky-600" />
              <div>
                <CardTitle>Gmail billing import</CardTitle>
                <p className="text-sm text-slate-600">
                  Connect Gmail to automatically scan recent billing, trial, and
                  cancellation emails across supported providers.
                </p>
              </div>
            </div>
            {gmailStatus?.connected ? (
              <Badge variant="success">Connected</Badge>
            ) : gmailStatus?.configured === false ? (
              <Badge variant="warning">Not configured</Badge>
            ) : (
              <Badge>Ready</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 text-sm text-slate-600">
            {gmailStatus?.connected ? (
              <>
                <p>
                  Signed in as{' '}
                  <span className="font-medium text-slate-900">
                    {gmailStatus.email ?? 'your Gmail account'}
                  </span>
                </p>
                <p>
                  Last synced:{' '}
                  {gmailStatus.lastSyncedAt
                    ? new Date(gmailStatus.lastSyncedAt).toLocaleString()
                    : 'Not yet synced'}
                </p>
              </>
            ) : gmailStatus?.configured === false ? (
              <p>
                Add <code className="text-xs">GOOGLE_OAUTH_CLIENT_ID</code> and{' '}
                <code className="text-xs">GOOGLE_OAUTH_CLIENT_SECRET</code> to
                enable Gmail OAuth in the local API.
              </p>
            ) : (
              <p>
                Read-only Gmail access is used to import billing emails locally.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {gmailStatus?.connected ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => void handleSyncGmail()}
                  disabled={syncingGmail}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {syncingGmail ? 'Syncing...' : 'Sync now'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleDisconnectGmail()}
                >
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                onClick={() => void handleConnectGmail()}
                disabled={connectingGmail || gmailStatus?.configured === false}
              >
                {connectingGmail ? 'Opening browser...' : 'Connect Gmail'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Server className="h-7 w-7 text-slate-600" />
              <div>
                <CardTitle>IMAP mailbox sync (iCloud, Fastmail, Outlook, Proton Bridge)</CardTitle>
                <p className="text-sm text-slate-500">
                  Connect any standard IMAP inbox with an app-specific password.
                  Credentials are encrypted locally with AES-256-GCM.
                </p>
              </div>
            </div>
            {imapStatus?.connected ? (
              <Badge variant="success">Connected</Badge>
            ) : (
              <Badge>Optional</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {imapStatus?.connected ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-slate-600">
                <p>
                  Connected to{' '}
                  <span className="font-medium text-slate-900">
                    {imapStatus.username} ({imapStatus.host}:{imapStatus.port})
                  </span>
                </p>
                <p>
                  Last synced:{' '}
                  {imapStatus.lastSyncedAt
                    ? new Date(imapStatus.lastSyncedAt).toLocaleString()
                    : 'Not yet synced'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={busyImap}
                  onClick={() => void handleSyncImap()}
                >
                  {busyImap ? 'Syncing...' : 'Sync IMAP'}
                </Button>
                <Button
                  variant="outline"
                  disabled={busyImap}
                  onClick={() => void handleDisconnectImap()}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ) : showImapForm ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium text-slate-700">
                IMAP host
                <input
                  type="text"
                  placeholder="imap.mail.me.com"
                  value={imapForm.host}
                  onChange={(e) =>
                    setImapForm((p) => ({ ...p, host: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-slate-700">
                Port
                <input
                  type="number"
                  value={imapForm.port}
                  onChange={(e) =>
                    setImapForm((p) => ({ ...p, port: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-slate-700">
                Mailbox
                <input
                  type="text"
                  value={imapForm.mailbox}
                  onChange={(e) =>
                    setImapForm((p) => ({ ...p, mailbox: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-slate-700">
                Username / Email
                <input
                  type="text"
                  value={imapForm.username}
                  onChange={(e) =>
                    setImapForm((p) => ({ ...p, username: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-slate-700">
                App password
                <input
                  type="password"
                  value={imapForm.password}
                  onChange={(e) =>
                    setImapForm((p) => ({ ...p, password: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
                />
              </label>
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  disabled={busyImap || !imapForm.host || !imapForm.username || !imapForm.password}
                  onClick={() => void handleConnectImap()}
                >
                  {busyImap ? 'Verifying...' : 'Save & connect'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowImapForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowImapForm(true)}>
              Configure IMAP mailbox
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => void handleEmlDrop(e)}
          className="border-dashed border-slate-300"
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="h-7 w-7 text-slate-500" />
              <div>
                <CardTitle>Drop .eml receipt files</CardTitle>
                <p className="text-sm text-slate-500">
                  Drag and drop saved `.eml` billing or cancellation emails from
                  Apple Mail, Thunderbird, or Outlook.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <label className="inline-flex cursor-pointer">
              <input
                type="file"
                accept=".eml,message/rfc822"
                multiple
                className="sr-only"
                disabled={uploadingFile}
                onChange={(e) => void handleEmlInput(e)}
              />
              <Button variant="outline" disabled={uploadingFile} asChild>
                <span>
                  {uploadingFile ? 'Processing...' : 'Select .eml files'}
                </span>
              </Button>
            </label>
          </CardContent>
        </Card>

        <Card className="border-dashed border-slate-300">
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-7 w-7 text-slate-500" />
              <div>
                <CardTitle>Local bank / card CSV statement scan</CardTitle>
                <p className="text-sm text-slate-500">
                  Detect recurring merchant charges 100% locally and queue
                  candidates in Import Review — zero bank credentials needed.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <label className="inline-flex cursor-pointer">
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                disabled={uploadingFile}
                onChange={(e) => void handleBankCsvInput(e)}
              />
              <Button variant="outline" disabled={uploadingFile} asChild>
                <span>
                  {uploadingFile ? 'Scanning...' : 'Analyze statement CSV'}
                </span>
              </Button>
            </label>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {services.map((service) => {
          const state = connectionState[service.id] ?? 'idle';
          const isManual = state === 'manual';
          const isConnected = state === 'connected';

          return (
            <Card key={service.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{service.name}</CardTitle>
                  {isConnected ? (
                    <Badge variant="success">Connected</Badge>
                  ) : isManual ? (
                    <Badge variant="warning">Saved</Badge>
                  ) : state === 'pending' ? (
                    <Badge>Pending</Badge>
                  ) : (
                    <Badge>Ready</Badge>
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  {service.description ?? 'No provider description available.'}
                </p>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                {isConnected ? (
                  <p className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> Linked through the
                    local API
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    {service.supportsOAuth
                      ? 'Connect and persist local provider access'
                      : 'Save a manual or email-based import source'}
                  </p>
                )}
                <div className="flex gap-2">
                  {isConnected || isManual ? (
                    <Button
                      variant="outline"
                      onClick={() => void handleDisconnect(service)}
                      disabled={connectionState[service.id] === 'pending'}
                    >
                      Disconnect
                    </Button>
                  ) : null}
                  <Button
                    variant={isConnected ? 'outline' : 'default'}
                    onClick={() => void handleConnect(service)}
                    disabled={connectionState[service.id] === 'pending'}
                  >
                    {isConnected
                      ? 'Reconnect'
                      : isManual
                        ? 'Queue import'
                        : 'Connect'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card className="border-dashed border-slate-300">
        <CardHeader className="flex flex-row items-center gap-3">
          <PlugZap className="h-10 w-10 text-slate-400" />
          <div>
            <CardTitle>Email forwarding alias</CardTitle>
            <p className="text-sm text-slate-500">
              Send streaming invoices to{' '}
              <span className="font-mono text-slate-800">
                {settings?.emailForwardingAlias ?? 'subs+general@subsync.app'}
              </span>
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() =>
              navigator.clipboard.writeText(
                settings?.emailForwardingAlias ?? 'subs+general@subsync.app',
              )
            }
          >
            Copy alias
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Test Email Import</CardTitle>
          <p className="text-sm text-slate-500">
            This posts a billing email payload to the local ingest API and
            creates or updates a subscription.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Sender
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={emailDraft.sender}
              onChange={(event) =>
                setEmailDraft((current) => ({
                  ...current,
                  sender: event.target.value,
                }))
              }
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Subject
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={emailDraft.subject}
              onChange={(event) =>
                setEmailDraft((current) => ({
                  ...current,
                  subject: event.target.value,
                }))
              }
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Body
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={emailDraft.body}
              onChange={(event) =>
                setEmailDraft((current) => ({
                  ...current,
                  body: event.target.value,
                }))
              }
            />
          </label>
          <Button
            onClick={() => void handleEmailImport()}
            disabled={importingEmail}
          >
            {importingEmail ? 'Importing...' : 'Import billing email'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function buildConnectionState(
  services: ServiceProvider[],
  connections: IntegrationConnection[],
): ConnectionState {
  const defaults = Object.fromEntries(
    services.map((service) => [
      service.id,
      service.supportsOAuth ? 'idle' : 'manual',
    ]),
  ) as ConnectionState;

  for (const connection of connections) {
    defaults[connection.providerId] = connection.status;
  }

  return defaults;
}
