import {
  BillingInterval,
  SubscriptionStatus,
} from '@subscription-tracker/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function isBillableStatus(status: SubscriptionStatus | string): boolean {
  return (
    status === 'active' ||
    status === 'trial' ||
    status === 'flagged_for_cancellation'
  );
}

export function normalizeBillingInterval(value: string): BillingInterval {
  if (
    value === 'weekly' ||
    value === 'monthly' ||
    value === 'quarterly' ||
    value === 'yearly' ||
    value === 'custom'
  ) {
    return value;
  }
  return 'monthly';
}

export function toMonthlyEquivalent(
  amount: number,
  interval: BillingInterval,
  customIntervalDays?: number | null,
): number {
  switch (interval) {
    case 'weekly':
      return (amount * 52) / 12;
    case 'monthly':
      return amount;
    case 'quarterly':
      return amount / 3;
    case 'yearly':
      return amount / 12;
    case 'custom':
      if (customIntervalDays && customIntervalDays > 0) {
        return (amount * 365) / (12 * customIntervalDays);
      }
      return amount;
    default: {
      const exhaustiveCheck: never = interval;
      return exhaustiveCheck;
    }
  }
}

export function addMonthsClampedUtc(
  value: Date,
  months: number,
  anchorDay = value.getUTCDate(),
): Date {
  const target = new Date(value);
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(anchorDay, lastDay));
  return target;
}

export function advanceRenewalDate(
  anchor: Date,
  interval: BillingInterval,
  steps = 1,
  customIntervalDays?: number | null,
  anchorDay = anchor.getUTCDate(),
): Date | null {
  switch (interval) {
    case 'weekly':
      return new Date(anchor.getTime() + steps * 7 * DAY_MS);
    case 'monthly':
      return addMonthsClampedUtc(anchor, steps, anchorDay);
    case 'quarterly':
      return addMonthsClampedUtc(anchor, steps * 3, anchorDay);
    case 'yearly':
      return addMonthsClampedUtc(anchor, steps * 12, anchorDay);
    case 'custom':
      if (customIntervalDays && customIntervalDays > 0) {
        return new Date(anchor.getTime() + steps * customIntervalDays * DAY_MS);
      }
      return null;
    default: {
      const exhaustiveCheck: never = interval;
      return exhaustiveCheck;
    }
  }
}
