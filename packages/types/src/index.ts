export type SubscriptionStatus = 'active' | 'trial' | 'canceled_pending';
export type BillingInterval = 'monthly' | 'yearly' | 'quarterly' | 'custom';
export type SubscriptionEventType = 'created' | 'status_changed' | 'renewal';

export interface ServiceProvider {
  id: string;
  name: string;
  category: 'streaming' | 'music' | 'gaming' | 'other';
  supportsOAuth: boolean;
  description?: string;
  logoUrl?: string;
}

export interface Subscription {
  id: string;
  serviceId: string;
  planName: string;
  status: SubscriptionStatus;
  billingAmount: number;
  billingCurrency: string;
  billingInterval: BillingInterval;
  nextRenewal: string; // ISO date
  paymentSource?: 'card' | 'paypal' | 'gift' | 'other';
  paymentLast4?: string;
  autoImportSource?: 'oauth' | 'email' | 'manual';
  notes?: string;
  nextRenewalReminderSent?: boolean;
  statusChangedAt: string;
}

export interface SubscriptionEvent {
  id: string;
  subscriptionId: string;
  eventType: SubscriptionEventType;
  status: SubscriptionStatus;
  notes?: string;
  occurredAt: string;
}

export interface NotificationPreference {
  id: string;
  leadTimeDays: number;
  channels: Array<'email' | 'push'>;
  updatedAt?: string;
}
