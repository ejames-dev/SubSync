import type { BillingInterval } from '@subscription-tracker/types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

const DAY_MS = 24 * 60 * 60 * 1000;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currency = 'USD',
  locale = 'en-US',
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// Mirrors apps/api/src/common/billing.ts; custom intervals count as monthly.
export function toMonthlyEquivalent(
  amount: number,
  interval: BillingInterval,
): number {
  switch (interval) {
    case 'yearly':
      return amount / 12;
    case 'quarterly':
      return amount / 3;
    case 'monthly':
    case 'custom':
      return amount;
    default: {
      const unhandled: never = interval;
      return unhandled;
    }
  }
}

export function describeCostComparison(
  amount: number,
  currency: string,
  interval: BillingInterval,
): string | null {
  const monthly = toMonthlyEquivalent(amount, interval);
  switch (interval) {
    case 'yearly':
      return `≈ ${formatCurrency(monthly, currency)}/mo`;
    case 'quarterly':
      return `≈ ${formatCurrency(monthly, currency)}/mo · ${formatCurrency(monthly * 12, currency)}/yr`;
    case 'monthly':
      return `≈ ${formatCurrency(monthly * 12, currency)}/yr`;
    case 'custom':
      return null;
    default: {
      const unhandled: never = interval;
      return unhandled;
    }
  }
}

export function daysUntil(isoDate: string, now = new Date()): number {
  const target = Date.parse(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / DAY_MS);
}

export function formatTrialCountdown(trialEndsAt: string): string {
  const days = daysUntil(trialEndsAt);
  if (days < 0) {
    return 'Trial ended';
  }
  if (days === 0) {
    return 'Trial ends today';
  }
  return `Trial ends in ${days} day${days === 1 ? '' : 's'}`;
}

export function isRenewalSnoozed(subscription: {
  snoozedUntil?: string;
}): boolean {
  if (!subscription.snoozedUntil) {
    return false;
  }

  return new Date(subscription.snoozedUntil).getTime() > Date.now();
}
