import { cache } from 'react';
import type {
  BillingInterval,
  DashboardSummary,
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
