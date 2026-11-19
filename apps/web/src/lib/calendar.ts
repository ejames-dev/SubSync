import type {
  BillingInterval,
  ServiceProvider,
  Subscription,
} from '@subscription-tracker/types';

export interface CalendarChargeOccurrence {
  subscriptionId: string;
  serviceId: string;
  serviceName: string;
  planName: string;
  dateKey: string; // YYYY-MM-DD (UTC)
  amount: number;
  currency: string;
  isTrialEnd: boolean;
  status: Subscription['status'];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function toMonthlyEquivalentClient(
  amount: number,
  interval: BillingInterval,
  customIntervalDays?: number,
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

function addMonthsClampedUtc(
  value: Date,
  months: number,
  anchorDay: number,
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

function stepDate(
  anchor: Date,
  interval: BillingInterval,
  step: number,
  customIntervalDays?: number,
): Date | null {
  const anchorDay = anchor.getUTCDate();
  switch (interval) {
    case 'weekly':
      return new Date(anchor.getTime() + step * 7 * DAY_MS);
    case 'monthly':
      return addMonthsClampedUtc(anchor, step, anchorDay);
    case 'quarterly':
      return addMonthsClampedUtc(anchor, step * 3, anchorDay);
    case 'yearly':
      return addMonthsClampedUtc(anchor, step * 12, anchorDay);
    case 'custom':
      if (customIntervalDays && customIntervalDays > 0) {
        return new Date(anchor.getTime() + step * customIntervalDays * DAY_MS);
      }
      return step === 0 ? anchor : null;
    default: {
      const exhaustiveCheck: never = interval;
      return exhaustiveCheck;
    }
  }
}

export function projectMonthOccurrences(
  subscriptions: Subscription[],
  servicesById: Record<string, ServiceProvider>,
  year: number,
  monthIndex: number,
): CalendarChargeOccurrence[] {
  const monthStart = new Date(Date.UTC(year, monthIndex, 1));
  const monthEndExclusive = new Date(Date.UTC(year, monthIndex + 1, 1));
  const occurrences: CalendarChargeOccurrence[] = [];

  for (const sub of subscriptions) {
    if (sub.status === 'paused' || sub.status === 'canceled') {
      continue;
    }
    const anchorIso =
      sub.status === 'trial' && sub.trialEndsAt
        ? sub.trialEndsAt
        : sub.nextRenewal;
    const anchor = new Date(anchorIso);
    if (Number.isNaN(anchor.getTime())) {
      continue;
    }

    const serviceName = servicesById[sub.serviceId]?.name ?? sub.serviceId;

    if (sub.status === 'canceled_pending') {
      if (anchor >= monthStart && anchor < monthEndExclusive) {
        occurrences.push({
          subscriptionId: sub.id,
          serviceId: sub.serviceId,
          serviceName,
          planName: sub.planName,
          dateKey: anchor.toISOString().slice(0, 10),
          amount: 0,
          currency: sub.billingCurrency,
          isTrialEnd: false,
          status: sub.status,
        });
      }
      continue;
    }

    if (
      sub.billingInterval === 'custom' &&
      (!sub.customIntervalDays || sub.customIntervalDays <= 0)
    ) {
      if (anchor >= monthStart && anchor < monthEndExclusive) {
        occurrences.push({
          subscriptionId: sub.id,
          serviceId: sub.serviceId,
          serviceName,
          planName: sub.planName,
          dateKey: anchor.toISOString().slice(0, 10),
          amount: sub.billingAmount,
          currency: sub.billingCurrency,
          isTrialEnd: sub.status === 'trial',
          status: sub.status,
        });
      }
      continue;
    }

    let step = 0;
    let current = stepDate(
      anchor,
      sub.billingInterval,
      0,
      sub.customIntervalDays,
    );

    while (current && current >= monthEndExclusive && step > -520) {
      step -= 1;
      current = stepDate(
        anchor,
        sub.billingInterval,
        step,
        sub.customIntervalDays,
      );
    }
    while (current && step > -520) {
      const previous = stepDate(
        anchor,
        sub.billingInterval,
        step - 1,
        sub.customIntervalDays,
      );
      if (!previous || previous < monthStart) {
        break;
      }
      step -= 1;
      current = previous;
    }
    while (current && current < monthStart && step < 520) {
      step += 1;
      current = stepDate(
        anchor,
        sub.billingInterval,
        step,
        sub.customIntervalDays,
      );
    }
    while (current && current < monthEndExclusive && step < 520) {
      const isTrialConversion = sub.status === 'trial' && step === 0;
      const effectiveAmount =
        sub.status === 'trial' && sub.postTrialAmount !== undefined && step >= 0
          ? sub.postTrialAmount
          : sub.billingAmount;

      occurrences.push({
        subscriptionId: sub.id,
        serviceId: sub.serviceId,
        serviceName,
        planName: sub.planName,
        dateKey: current.toISOString().slice(0, 10),
        amount: effectiveAmount,
        currency: sub.billingCurrency,
        isTrialEnd: isTrialConversion,
        status: sub.status,
      });

      step += 1;
      current = stepDate(
        anchor,
        sub.billingInterval,
        step,
        sub.customIntervalDays,
      );
    }
  }

  return occurrences.sort(
    (a, b) =>
      a.dateKey.localeCompare(b.dateKey) ||
      a.serviceName.localeCompare(b.serviceName),
  );
}
