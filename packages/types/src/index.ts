export type BillingInterval = 'monthly' | 'yearly' | 'quarterly' | 'custom';

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
  status: 'active' | 'trial' | 'canceled_pending';
  billingAmount: number;
  billingCurrency: string;
  billingInterval: BillingInterval;
  nextRenewal: string; // ISO date
  paymentSource?: 'card' | 'paypal' | 'gift' | 'other';
  paymentLast4?: string;
  autoImportSource?: 'oauth' | 'email' | 'manual';
  notes?: string;
}

export interface NotificationPreference {
  leadTimeDays: number;
  channels: Array<'email' | 'push'>;
}
