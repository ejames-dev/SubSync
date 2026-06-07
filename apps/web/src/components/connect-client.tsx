'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type {
  GmailConnectionStatus,
  IntegrationConnection,
  ServiceProvider,
  UserSettings,
} from '@subscription-tracker/types';
import { CheckCircle2, Mail, PlugZap, RefreshCw } from 'lucide-react';
import {
  connectIntegration,
  disconnectGmail,
  disconnectIntegration,
  getGmailAuthUrl,
  getGmailStatus,
  getSettings,
  ingestEmail,
  listIntegrations,
  listServices,
  syncGmailBillingEmails,
} from '../lib/api';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

type ConnectionState = Record<string, 'idle' | 'pending' | 'connected' | 'manual'>;
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
  const [gmailStatus, setGmailStatus] = useState<GmailConnectionStatus | null>(null);
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
    ]).then(([serviceData, connections, currentSettings, gmail]) => {
      setServices(serviceData);
      setSettings(currentSettings);
      setGmailStatus(gmail);
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
      setStatusMessage(error instanceof Error ? error.message : 'Connection failed.');
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
        `Gmail sync complete: imported ${result.imported}, skipped ${result.skipped}, failed ${result.failed}.`,
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Gmail sync failed.',
      );
    } finally {
      setSyncingGmail(false);
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
      setConnectionState((current) => ({ ...current, [service.id]: 'connected' }));
      setStatusMessage(error instanceof Error ? error.message : 'Disconnect failed.');
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
      setConnectionState((current) => ({
        ...current,
        [result.subscription.serviceId]:
          result.subscription.autoImportSource === 'email' ? 'manual' : 'connected',
      }));
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
          These actions call the packaged local API and store any resulting subscriptions locally.
        </p>
      </div>
      {statusMessage ? <p className="text-sm text-slate-600">{statusMessage}</p> : null}
      <Card className="border-sky-200 bg-sky-50/40">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Mail className="h-8 w-8 text-sky-600" />
              <div>
                <CardTitle>Gmail billing import</CardTitle>
                <p className="text-sm text-slate-600">
                  Connect Gmail to automatically scan recent billing and subscription
                  emails from supported streaming providers.
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
                <code className="text-xs">GOOGLE_OAUTH_CLIENT_SECRET</code> to enable
                Gmail OAuth in the local API.
              </p>
            ) : (
              <p>Read-only Gmail access is used to import billing emails locally.</p>
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
                <Button variant="outline" onClick={() => void handleDisconnectGmail()}>
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
                    <CheckCircle2 className="h-4 w-4" /> Linked through the local API
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
                    {isConnected ? 'Reconnect' : isManual ? 'Queue import' : 'Connect'}
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
                {settings?.emailForwardingAlias ?? 'subs+general@beacon.app'}
              </span>
            </p>
          </div>
        </CardHeader>
        <CardContent>
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
      <Card>
        <CardHeader>
          <CardTitle>Test Email Import</CardTitle>
          <p className="text-sm text-slate-500">
            This posts a billing email payload to the local ingest API and creates or updates a
            subscription.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Sender
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={emailDraft.sender}
              onChange={(event) =>
                setEmailDraft((current) => ({ ...current, sender: event.target.value }))
              }
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Subject
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={emailDraft.subject}
              onChange={(event) =>
                setEmailDraft((current) => ({ ...current, subject: event.target.value }))
              }
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Body
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={emailDraft.body}
              onChange={(event) =>
                setEmailDraft((current) => ({ ...current, body: event.target.value }))
              }
            />
          </label>
          <Button onClick={() => void handleEmailImport()} disabled={importingEmail}>
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
