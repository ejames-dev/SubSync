import { cache } from 'react';
import type { RequestInit } from 'next/dist/server/web/spec-extension/request';
import {
  NotificationPreference,
  ServiceProvider,
  Subscription,
  SubscriptionEvent,
} from '@subscription-tracker/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

export const getSubscriptions = cache(() => request<Subscription[]>('/subscriptions'));
export const getServices = cache(() => request<ServiceProvider[]>('/services'));
export const getSubscription = (id: string) => request<Subscription>(`/subscriptions/${id}`);
export const getSubscriptionEvents = (id: string) =>
  request<SubscriptionEvent[]>(`/subscriptions/${id}/events`);
export const getRecentSubscriptionEvents = (limit = 5) =>
  request<SubscriptionEvent[]>(`/subscriptions/events/recent?limit=${limit}`);

export const createSubscription = (payload: unknown) =>
  request('/subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const getNotificationPreference = () =>
  request<NotificationPreference>('/notifications/preferences');

export const updateNotificationPreference = (payload: {
  leadTimeDays: number;
  channels: Array<'email' | 'push'>;
}) =>
  request<NotificationPreference>('/notifications/preferences', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
