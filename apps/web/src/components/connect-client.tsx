'use client';

import { useEffect, useState } from 'react';
import type {
  IntegrationConnection,
  ServiceProvider,
  UserSettings,
} from '@subscription-tracker/types';
import { CheckCircle2, PlugZap } from 'lucide-react';
import {
  connectIntegration,
  getSettings,
  ingestEmail,
  listIntegrations,
  listServices,
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
  const [services, setServices] = useState<ServiceProvider[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>({});
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [emailDraft, setEmailDraft] = useState<EmailDraft>({
    sender: 'billing@netflix.com',
    subject: 'Netflix Standard plan renews Apr 16, 2026',
    body: 'Amount: $15.49 billed monthly to card ending in 4242',
  });
  const [importingEmail, setImportingEmail] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([listServices(), listIntegrations(), getSettings()]).then(
      ([serviceData, connections, currentSettings]) => {
        setServices(serviceData);
        setSettings(currentSettings);
        setConnectionState(buildConnectionState(serviceData, connections));
      },
    );
  }, []);

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
                <Button
                  variant={isConnected ? 'outline' : 'default'}
                  onClick={() => void handleConnect(service)}
                  disabled={state === 'pending'}
                >
                  {isConnected ? 'Reconnect' : isManual ? 'Queue import' : 'Connect'}
                </Button>
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
