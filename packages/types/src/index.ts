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

export type NotificationChannel = 'email' | 'push';

export interface NotificationPreference {
  id: string;
  leadTimeDays: number;
  channels: Array<NotificationChannel>;
  updatedAt?: string;
}

export interface PendingRenewalNotification {
  id: string;
  subscriptionId: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  createdAt: string;
}

export interface UserSettings {
  notificationPreference: NotificationPreference;
  emailForwardingAlias: string;
}

export type IntegrationSource = 'oauth' | 'email' | 'manual';
export type IntegrationStatus = 'connected' | 'manual';

export interface IntegrationConnection {
  providerId: string;
  status: IntegrationStatus;
  source: IntegrationSource;
  connectedAt: string;
  lastSyncedAt?: string;
}

export interface DashboardSpendByCategory {
  category: ServiceProvider['category'];
  monthlyEquivalentSpend: number;
}

export interface DashboardDuplicateGroup {
  serviceId: string;
  serviceName: string;
  count: number;
}

export interface DashboardSummary {
  monthlyEquivalentSpend: number;
  activeSubscriptions: number;
  upcomingRenewalCount: number;
  nextRenewal?: {
    subscriptionId: string;
    serviceId: string;
    serviceName: string;
    nextRenewal: string;
  };
  sourceBreakdown: Record<'manual' | 'email' | 'oauth', number>;
  spendByCategory: DashboardSpendByCategory[];
  duplicateSubscriptions: DashboardDuplicateGroup[];
}

export interface EmailIngestResult {
  status: 'created' | 'updated';
  inferredProvider: string;
  subscription: Subscription;
  message: string;
  receivedAt: string;
}

export interface GmailConnectionStatus {
  connected: boolean;
  email?: string;
  connectedAt?: string;
  lastSyncedAt?: string;
  configured: boolean;
}

export interface GmailAuthUrlResponse {
  authUrl: string;
  state: string;
}

export interface GmailSyncResult {
  scanned: number;
  imported: number;
  skipped: number;
  failed: number;
  results: EmailIngestResult[];
  syncedAt: string;
}
