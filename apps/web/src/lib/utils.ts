import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

export function isRenewalSnoozed(subscription: {
  snoozedUntil?: string;
}): boolean {
  if (!subscription.snoozedUntil) {
    return false;
  }

  return new Date(subscription.snoozedUntil).getTime() > Date.now();
}
