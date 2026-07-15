export type SubscriptionStatus =
  | 'active'
  | 'trial'
  | 'flagged_for_cancellation'
  | 'canceled_pending';
export type BillingInterval = 'monthly' | 'yearly' | 'quarterly' | 'custom';
export type SubscriptionEventType =
  | 'created'
  | 'status_changed'
  | 'renewal'
  | 'price_changed';

export interface ServiceProvider {
  id: string;
  name: string;
  category: 'streaming' | 'music' | 'gaming' | 'other';
  supportsOAuth: boolean;
  description?: string;
  logoUrl?: string;
  cancelUrl?: string;
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
  snoozedUntil?: string;
  statusChangedAt: string;
}

export interface SubscriptionEvent {
  id: string;
  subscriptionId: string;
  eventType: SubscriptionEventType;
  status: SubscriptionStatus;
  notes?: string;
  previousAmount?: number;
  previousCurrency?: string;
  amount?: number;
  currency?: string;
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
  subscriptionId?: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  createdAt: string;
}

export interface UserSettings {
  notificationPreference: NotificationPreference;
  emailForwardingAlias: string;
  budgetCurrency: string;
  monthlyBudget?: {
    amount: number;
    currency: string;
    alertTriggered: boolean;
  };
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

export interface DashboardBudgetStatus {
  currency: string;
  monthlyEquivalentSpend: number;
  threshold?: number;
  percentUsed?: number;
  overBudget: boolean;
  excludedCurrencyCount: number;
}

export interface SpendForecastMonth {
  month: string;
  amount: number;
  renewalCount: number;
}

export interface SpendForecast {
  currency: string;
  total: number;
  horizonStart: string;
  horizonEnd: string;
  excludedCurrencyCount: number;
  months: SpendForecastMonth[];
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
  budget: DashboardBudgetStatus;
  forecast: SpendForecast;
}

export interface YearlyReviewSpendTotal {
  currency: string;
  amount: number;
  renewalCount: number;
  subscriptionCount: number;
}

export interface YearlyReviewPriceIncrease {
  subscriptionId: string;
  serviceId: string;
  serviceName: string;
  planName: string;
  previousAmount: number;
  newAmount: number;
  increaseAmount: number;
  increasePercent?: number;
  currency: string;
  occurredAt: string;
  dataSource: 'structured' | 'legacy_note';
}

export interface YearlyReviewSignal {
  subscriptionId: string;
  serviceId: string;
  serviceName: string;
  planName: string;
  reason: 'overdue_renewal' | 'stale_tracking_data';
  detail: string;
  lastActivityAt?: string;
  nextRenewal: string;
  confidence: 'low';
}

export interface YearlyReview {
  year: number;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  isEstimate: true;
  methodology: string;
  spendByCurrency: YearlyReviewSpendTotal[];
  biggestPriceIncreases: YearlyReviewPriceIncrease[];
  reviewSignals: YearlyReviewSignal[];
}

export type AppUpdateState =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'up-to-date'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface AppUpdateStatus {
  state: AppUpdateState;
  currentVersion: string;
  availableVersion?: string;
  percent?: number;
  message?: string;
}

export interface EmailIngestResult {
  status:
    | 'created'
    | 'updated'
    | 'ignored'
    | 'review'
    | 'mixed'
    | 'failed'
    | 'duplicate';
  inferredProvider: string;
  subscription?: Subscription;
  subscriptions: Subscription[];
  receiptId: string;
  items: EmailReceiptItem[];
  message: string;
  receivedAt: string;
}

export type EmailReceiptStatus =
  | 'processing'
  | 'imported'
  | 'review'
  | 'failed'
  | 'rejected';

export type EmailReceiptItemAction =
  | 'created'
  | 'updated'
  | 'ignored'
  | 'review'
  | 'rejected';

export interface EmailReceiptItem {
  id: string;
  receiptId: string;
  serviceId?: string;
  subscriptionId?: string;
  providerName: string;
  planName: string;
  billingAmount: number;
  billingCurrency: string;
  billingInterval: BillingInterval;
  nextRenewal: string;
  paymentSource?: Subscription['paymentSource'];
  paymentLast4?: string;
  confidence: number;
  action: EmailReceiptItemAction;
  evidence: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EmailReceipt {
  id: string;
  source: 'gmail' | 'manual';
  externalMessageId?: string;
  sender: string;
  subject: string;
  receivedAt: string;
  parserId?: string;
  parserVersion?: number;
  status: EmailReceiptStatus;
  confidence: number;
  bodySnapshot?: string;
  failureReason?: string;
  createdAt: string;
  reviewedAt?: string;
  items: EmailReceiptItem[];
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
  review: number;
  results: EmailIngestResult[];
  syncedAt: string;
}

export interface ExportedSubscription {
  id: string;
  serviceId: string;
  serviceName: string;
  planName: string;
  status: string;
  billingAmount: number;
  billingCurrency: string;
  billingInterval: string;
  nextRenewal: string;
  paymentSource?: string;
  paymentLast4?: string;
  autoImportSource?: string;
  notes?: string;
  statusChangedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionExportPayload {
  exportedAt: string;
  version: string;
  subscriptions: ExportedSubscription[];
}

export interface DataBackupInfo {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  createdAt: string;
}

export interface DataRestoreResult {
  restoredAt: string;
  sourceName: string;
  safetyBackupFileName: string;
  message: string;
}
