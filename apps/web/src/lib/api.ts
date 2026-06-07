import { cache } from 'react';
import type {
  BillingInterval,
  DashboardSummary,
  DataBackupInfo,
  DataRestoreResult,
  EmailIngestResult,
  IntegrationConnection,
  NotificationPreference,
  ServiceProvider,
  Subscription,
  SubscriptionEvent,
  UserSettings,
} from '@subscription-tracker/types';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:43100/api';

type ApiRequestOptions = {
  body?: string;
  headers?: Record<string, string>;
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
};

export function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    DEFAULT_API_BASE_URL
  );
}

async function apiRequest<T>(path: string, init?: ApiRequestOptions): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const getSubscriptions = cache(() => apiRequest<Subscription[]>('/subscriptions'));
export const getServices = cache(() => apiRequest<ServiceProvider[]>('/services'));
export const getSubscription = (id: string) =>
  apiRequest<Subscription>(`/subscriptions/${id}`);
export const getSubscriptionEvents = (id: string) =>
  apiRequest<SubscriptionEvent[]>(`/subscriptions/${id}/events`);
export const getRecentSubscriptionEvents = (limit = 5) =>
  apiRequest<SubscriptionEvent[]>(`/subscriptions/events/recent?limit=${limit}`);
export const getNotificationPreference = () =>
  apiRequest<NotificationPreference>('/notifications/preferences');
export const updateNotificationPreference = (payload: {
  leadTimeDays: number;
  channels: Array<'email' | 'push'>;
}) =>
  apiRequest<NotificationPreference>('/notifications/preferences', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export function listServices() {
  return getServices();
}

export function listSubscriptions() {
  return getSubscriptions();
}

export function getDashboardSummary() {
  return apiRequest<DashboardSummary>('/dashboard/summary');
}

export function createSubscription(payload: CreateSubscriptionPayload) {
  return apiRequest<Subscription>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateSubscription(
  id: string,
  payload: Partial<CreateSubscriptionPayload>,
) {
  return apiRequest<Subscription>(`/subscriptions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteSubscription(id: string) {
  return apiRequest<void>(`/subscriptions/${id}`, {
    method: 'DELETE',
  });
}

export function connectIntegration(
  provider: string,
  payload: Record<string, string>,
) {
  return apiRequest<{
    connection: IntegrationConnection;
    message: string;
  }>(`/integrations/${provider}/connect`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listIntegrations() {
  return apiRequest<IntegrationConnection[]>('/integrations');
}

export function getSettings() {
  return apiRequest<UserSettings>('/settings');
}

export function updateSettings(payload: {
  leadTimeDays: number;
  channels: Array<'email' | 'push'>;
}) {
  return apiRequest<UserSettings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function ingestEmail(payload: {
  sender: string;
  subject: string;
  receivedAt: string;
  body?: string;
}) {
  return apiRequest<EmailIngestResult>('/ingest/email', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function getDownloadFileName(
  response: Response,
  fallback: string,
): string {
  const disposition = response.headers.get('Content-Disposition');
  const match = disposition?.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadSubscriptionExport(format: 'csv' | 'json') {
  const response = await fetch(
    `${getApiBaseUrl()}/data/export/subscriptions?format=${format}`,
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Export failed with ${response.status}`);
  }

  const blob = await response.blob();
  triggerBrowserDownload(
    blob,
    getDownloadFileName(response, `subsync-subscriptions.${format}`),
  );
}

export function createDatabaseBackup() {
  return apiRequest<DataBackupInfo>('/data/backup', { method: 'POST' });
}

export function listDatabaseBackups() {
  return apiRequest<DataBackupInfo[]>('/data/backups');
}

export function getDatabaseBackupDownloadUrl(fileName: string) {
  return `${getApiBaseUrl()}/data/backup/${encodeURIComponent(fileName)}`;
}

export async function downloadDatabaseBackup(fileName: string) {
  const response = await fetch(getDatabaseBackupDownloadUrl(fileName));
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Backup download failed with ${response.status}`);
  }

  const blob = await response.blob();
  triggerBrowserDownload(blob, getDownloadFileName(response, fileName));
}

export async function restoreDatabaseBackup(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${getApiBaseUrl()}/data/restore`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Restore failed with ${response.status}`);
  }

  return (await response.json()) as DataRestoreResult;
}

export function restoreStoredDatabaseBackup(fileName: string) {
  return apiRequest<DataRestoreResult>(
    `/data/restore/${encodeURIComponent(fileName)}`,
    { method: 'POST' },
  );
}
type CreateSubscriptionPayload = {
  serviceId: string;
  planName: string;
  billingAmount: number;
  billingCurrency: string;
  billingInterval: BillingInterval;
  nextRenewal: string;
  paymentSource?: Subscription['paymentSource'];
  paymentLast4?: string;
  autoImportSource?: Subscription['autoImportSource'];
  notes?: string;
  status?: Subscription['status'];
};
