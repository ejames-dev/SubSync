export type ReceiptBillingInterval = 'monthly' | 'quarterly' | 'yearly';

export type ReceiptPaymentSource = 'card' | 'paypal';

export interface ReceiptEmailInput {
  sender: string;
  subject: string;
  body?: string;
  receivedAt: string;
  authenticatedSender?: boolean;
}

export interface ParsedReceiptEvidence {
  amount: string;
  plan?: string;
  renewalDate?: string;
}

export interface ParsedReceiptItem {
  /** The subscription provider or product, not necessarily the email merchant. */
  providerName: string;
  /** The merchant that issued the receipt when it differs from the provider. */
  merchantName?: string;
  planName: string;
  billingAmount: number;
  billingCurrency: string;
  billingInterval?: ReceiptBillingInterval;
  nextRenewal?: string;
  paymentSource?: ReceiptPaymentSource;
  paymentLast4?: string;
  confidence: number;
  evidence: ParsedReceiptEvidence;
}

export interface ReceiptParseResult {
  parserId: string;
  parserVersion: number;
  confidence: number;
  items: ParsedReceiptItem[];
  warnings: string[];
}

export interface EmailReceiptParser {
  readonly id: string;
  readonly version: number;
  matches(input: ReceiptEmailInput): boolean;
  parse(input: ReceiptEmailInput): ReceiptParseResult;
}
