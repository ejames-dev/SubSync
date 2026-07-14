import {
  ParsedReceiptEvidence,
  ReceiptBillingInterval,
  ReceiptEmailInput,
  ReceiptPaymentSource,
} from './parser.types';

export interface MoneyMatch {
  amount: number;
  currency: string;
  raw: string;
  index: number;
}

const CURRENCY_CODES: Record<string, string> = {
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  CAD: 'CAD',
  AUD: 'AUD',
};

export function emailContent(input: ReceiptEmailInput): string {
  return `${input.sender}\n${input.subject}\n${input.body ?? ''}`;
}

export function plainText(content: string): string {
  return content
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/tr>|<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&pound;/gi, '£')
    .replace(/&euro;/gi, '€')
    .replace(/\r/g, '')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function senderDomain(sender: string): string | undefined {
  const address = sender.match(/<?([^<>\s]+@[^<>\s]+)>?/)?.[1];
  return address?.split('@')[1]?.toLowerCase();
}

export function isSenderDomain(sender: string, domain: string): boolean {
  const actual = senderDomain(sender);
  return actual === domain || actual?.endsWith(`.${domain}`) === true;
}

export function findMoney(content: string): MoneyMatch[] {
  const matches: MoneyMatch[] = [];
  const pattern =
    /(?:(USD|EUR|GBP|CAD|AUD|\$|€|£)\s*([0-9]+(?:[.,][0-9]{2})?)|([0-9]+(?:[.,][0-9]{2})?)\s*(USD|EUR|GBP|CAD|AUD))/gi;

  for (const match of content.matchAll(pattern)) {
    const marker = (match[1] ?? match[4]).toUpperCase();
    const numeric = (match[2] ?? match[3]).replace(',', '.');
    matches.push({
      amount: Number(numeric),
      currency: CURRENCY_CODES[marker] ?? marker,
      raw: match[0],
      index: match.index ?? 0,
    });
  }
  return matches;
}

export function findPreferredMoney(content: string): MoneyMatch | undefined {
  const labeled = [
    /(?:amount|charged|charge|payment|price)\s*(?:due|paid)?\s*:?\s*((?:USD|EUR|GBP|CAD|AUD|\$|€|£)\s*[0-9]+(?:[.,][0-9]{2})?)/i,
    /(?:amount|charged|charge|payment|price)\s*(?:due|paid)?\s*:?\s*([0-9]+(?:[.,][0-9]{2})?\s*(?:USD|EUR|GBP|CAD|AUD))/i,
  ];

  for (const pattern of labeled) {
    const match = content.match(pattern);
    if (match) {
      return findMoney(match[1])[0];
    }
  }

  return findMoney(content)[0];
}

export function detectInterval(
  content: string,
): ReceiptBillingInterval | undefined {
  if (/\b(?:annual(?:ly)?|yearly|per year|\/\s*year)\b/i.test(content)) {
    return 'yearly';
  }
  if (/\b(?:quarterly|every three months|per quarter)\b/i.test(content)) {
    return 'quarterly';
  }
  if (/\b(?:monthly|per month|\/\s*month)\b/i.test(content)) {
    return 'monthly';
  }
  return undefined;
}

export function detectRenewalDate(content: string):
  | {
      iso: string;
      raw: string;
    }
  | undefined {
  const match =
    content.match(
      /\b(?:renews?|next billing date|next charge|billing date)\s*:?\s*([A-Z][a-z]{2,8}\s+\d{1,2},?\s+\d{4})/i,
    ) ??
    content.match(
      /\b(?:renews?|next billing date|next charge|billing date)\s*:?\s*(\d{4}-\d{2}-\d{2})/i,
    );
  if (!match) {
    return undefined;
  }

  const parsed = new Date(`${match[1]} 00:00:00 UTC`);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return { iso: parsed.toISOString(), raw: match[0] };
}

export function detectPayment(content: string): {
  paymentSource?: ReceiptPaymentSource;
  paymentLast4?: string;
} {
  const paymentSource = /\bpaypal\b/i.test(content)
    ? 'paypal'
    : /\b(?:visa|mastercard|amex|card)\b/i.test(content)
      ? 'card'
      : undefined;
  const paymentLast4 =
    content.match(
      /\b(?:ending in|last 4|last four|card ending in)\s*(?:\*+\s*)?(\d{4})\b/i,
    )?.[1] ?? content.match(/\*{2,}\s*(\d{4})\b/)?.[1];
  return { paymentSource, paymentLast4 };
}

export function evidence(
  amount: string,
  plan?: string,
  renewalDate?: string,
): ParsedReceiptEvidence {
  return {
    amount,
    ...(plan ? { plan } : {}),
    ...(renewalDate ? { renewalDate } : {}),
  };
}

export function averageConfidence(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return Number(
    (values.reduce((total, value) => total + value, 0) / values.length).toFixed(
      2,
    ),
  );
}
