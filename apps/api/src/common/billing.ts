import type { BillingInterval } from '@subscription-tracker/types';

// Custom intervals have no known cadence, so they are treated as monthly.
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

export function parseBillingInterval(value: string): BillingInterval {
  if (
    value === 'yearly' ||
    value === 'quarterly' ||
    value === 'custom' ||
    value === 'monthly'
  ) {
    return value;
  }
  return 'monthly';
}
