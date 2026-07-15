import { Injectable } from '@nestjs/common';
import {
  YearlyReview,
  YearlyReviewPriceIncrease,
  YearlyReviewSignal,
  YearlyReviewSpendTotal,
} from '@subscription-tracker/types';
import { PrismaService } from '../prisma/prisma.service';

type ReviewEvent = {
  eventType: string;
  notes: string | null;
  occurredAt: Date;
  previousAmountCents: number | null;
  previousCurrency: string | null;
  amountCents: number | null;
  currency: string | null;
};

type ReviewSubscription = {
  id: string;
  serviceId: string;
  planName: string;
  status: string;
  billingAmountCents: number;
  billingCurrency: string;
  billingInterval: string;
  nextRenewal: Date;
  statusChangedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  lastImportedAt: Date | null;
  service: { name: string };
  events: ReviewEvent[];
};

type ParsedPriceChange = {
  previousAmountCents: number;
  previousCurrency: string;
  amountCents: number;
  currency: string;
  dataSource: YearlyReviewPriceIncrease['dataSource'];
};

@Injectable()
export class YearlyReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getReview(year: number, now = new Date()): Promise<YearlyReview> {
    const periodStart = new Date(Date.UTC(year, 0, 1));
    const yearEndExclusive = new Date(Date.UTC(year + 1, 0, 1));
    const periodEndExclusive = this.clamp(now, periodStart, yearEndExclusive);
    const subscriptions = (await this.prisma.subscription.findMany({
      include: {
        service: true,
        events: { orderBy: { occurredAt: 'desc' } },
      },
    })) as ReviewSubscription[];

    return {
      year,
      generatedAt: now.toISOString(),
      periodStart: periodStart.toISOString(),
      periodEnd: this.toReportedPeriodEnd(
        periodStart,
        periodEndExclusive,
        yearEndExclusive,
      ).toISOString(),
      isEstimate: true,
      methodology:
        'Estimated from tracked renewal dates, billing intervals, creation dates, and recorded price changes. Currency totals stay separate, and increases are ranked by percentage rather than comparing face values across currencies. It is not a bank or usage ledger; deleted subscriptions and unrecorded payments are not included.',
      spendByCurrency: this.buildSpendTotals(
        subscriptions,
        periodStart,
        periodEndExclusive,
      ),
      biggestPriceIncreases: this.buildPriceIncreases(
        subscriptions,
        periodStart,
        periodEndExclusive,
      ),
      reviewSignals: this.buildReviewSignals(
        subscriptions,
        periodStart,
        periodEndExclusive,
        now,
      ),
    };
  }

  private buildSpendTotals(
    subscriptions: ReviewSubscription[],
    periodStart: Date,
    periodEndExclusive: Date,
  ): YearlyReviewSpendTotal[] {
    const totals = new Map<
      string,
      { amountCents: number; renewalCount: number; subscriptions: Set<string> }
    >();

    for (const subscription of subscriptions) {
      const subscriptionEnd =
        subscription.status === 'canceled_pending'
          ? this.minDate(periodEndExclusive, subscription.statusChangedAt)
          : periodEndExclusive;
      const firstTrackedAt = this.maxDate(periodStart, subscription.createdAt);
      if (subscriptionEnd.getTime() <= firstTrackedAt.getTime()) {
        continue;
      }

      const renewals = this.renewalsBetween(
        subscription,
        firstTrackedAt,
        subscriptionEnd,
      );
      for (const renewal of renewals) {
        const price = this.priceAt(subscription, renewal);
        const bucket = totals.get(price.currency) ?? {
          amountCents: 0,
          renewalCount: 0,
          subscriptions: new Set<string>(),
        };
        bucket.amountCents += price.amountCents;
        bucket.renewalCount += 1;
        bucket.subscriptions.add(subscription.id);
        totals.set(price.currency, bucket);
      }
    }

    return Array.from(totals.entries())
      .map(([currency, value]) => ({
        currency,
        amount: value.amountCents / 100,
        renewalCount: value.renewalCount,
        subscriptionCount: value.subscriptions.size,
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency));
  }

  private buildPriceIncreases(
    subscriptions: ReviewSubscription[],
    periodStart: Date,
    periodEndExclusive: Date,
  ): YearlyReviewPriceIncrease[] {
    const increases: YearlyReviewPriceIncrease[] = [];

    for (const subscription of subscriptions) {
      for (const event of subscription.events) {
        if (
          event.eventType !== 'price_changed' ||
          event.occurredAt.getTime() < periodStart.getTime() ||
          event.occurredAt.getTime() >= periodEndExclusive.getTime()
        ) {
          continue;
        }
        const priceChange = this.parsePriceChange(event);
        if (
          !priceChange ||
          priceChange.previousCurrency !== priceChange.currency ||
          priceChange.amountCents <= priceChange.previousAmountCents
        ) {
          continue;
        }

        const increaseAmountCents =
          priceChange.amountCents - priceChange.previousAmountCents;
        increases.push({
          subscriptionId: subscription.id,
          serviceId: subscription.serviceId,
          serviceName: subscription.service.name,
          planName: subscription.planName,
          previousAmount: priceChange.previousAmountCents / 100,
          newAmount: priceChange.amountCents / 100,
          increaseAmount: increaseAmountCents / 100,
          increasePercent:
            priceChange.previousAmountCents > 0
              ? Math.round(
                  (increaseAmountCents / priceChange.previousAmountCents) *
                    1000,
                ) / 10
              : undefined,
          currency: priceChange.currency,
          occurredAt: event.occurredAt.toISOString(),
          dataSource: priceChange.dataSource,
        });
      }
    }

    return increases
      .sort((a, b) => {
        const percentDifference =
          (b.increasePercent ?? -1) - (a.increasePercent ?? -1);
        if (percentDifference !== 0) return percentDifference;

        const dateDifference = b.occurredAt.localeCompare(a.occurredAt);
        if (dateDifference !== 0) return dateDifference;

        if (a.currency === b.currency) {
          const amountDifference = b.increaseAmount - a.increaseAmount;
          if (amountDifference !== 0) return amountDifference;
        }
        return (
          a.currency.localeCompare(b.currency) ||
          a.serviceName.localeCompare(b.serviceName)
        );
      })
      .slice(0, 5);
  }

  private buildReviewSignals(
    subscriptions: ReviewSubscription[],
    periodStart: Date,
    periodEndExclusive: Date,
    now: Date,
  ): YearlyReviewSignal[] {
    if (periodEndExclusive.getTime() <= periodStart.getTime()) {
      return [];
    }
    const asOf = this.minDate(periodEndExclusive, now);
    const overdueCutoff = this.daysBefore(asOf, 30);
    const staleCutoff = this.daysBefore(asOf, 180);

    return subscriptions
      .filter(
        (subscription) =>
          subscription.status !== 'canceled_pending' &&
          subscription.createdAt.getTime() <= asOf.getTime(),
      )
      .map((subscription): YearlyReviewSignal | null => {
        const lastActivityAt = this.lastActivityAt(subscription, asOf);
        if (subscription.nextRenewal.getTime() < overdueCutoff.getTime()) {
          return {
            subscriptionId: subscription.id,
            serviceId: subscription.serviceId,
            serviceName: subscription.service.name,
            planName: subscription.planName,
            reason: 'overdue_renewal',
            detail:
              'The tracked renewal date is more than 30 days overdue. Confirm whether this service renewed or is still active.',
            lastActivityAt: lastActivityAt?.toISOString(),
            nextRenewal: subscription.nextRenewal.toISOString(),
            confidence: 'low',
          };
        }
        if (
          !lastActivityAt ||
          lastActivityAt.getTime() < staleCutoff.getTime()
        ) {
          return {
            subscriptionId: subscription.id,
            serviceId: subscription.serviceId,
            serviceName: subscription.service.name,
            planName: subscription.planName,
            reason: 'stale_tracking_data',
            detail:
              'No import, edit, or subscription event has been recorded for at least 180 days. This is a tracking signal, not proof of non-use.',
            lastActivityAt: lastActivityAt?.toISOString(),
            nextRenewal: subscription.nextRenewal.toISOString(),
            confidence: 'low',
          };
        }
        return null;
      })
      .filter((signal): signal is YearlyReviewSignal => signal !== null)
      .sort((a, b) => a.serviceName.localeCompare(b.serviceName));
  }

  private renewalsBetween(
    subscription: ReviewSubscription,
    start: Date,
    endExclusive: Date,
  ): Date[] {
    if (subscription.billingInterval === 'custom') {
      return subscription.nextRenewal.getTime() >= start.getTime() &&
        subscription.nextRenewal.getTime() < endExclusive.getTime()
        ? [subscription.nextRenewal]
        : [];
    }

    const intervalMonths =
      subscription.billingInterval === 'yearly'
        ? 12
        : subscription.billingInterval === 'quarterly'
          ? 3
          : 1;
    const anchorDay = subscription.nextRenewal.getUTCDate();
    let cursor = new Date(subscription.nextRenewal);

    while (cursor.getTime() >= endExclusive.getTime()) {
      cursor = this.addMonthsClamped(cursor, -intervalMonths, anchorDay);
    }
    while (
      this.addMonthsClamped(cursor, -intervalMonths, anchorDay).getTime() >=
      start.getTime()
    ) {
      cursor = this.addMonthsClamped(cursor, -intervalMonths, anchorDay);
    }
    while (cursor.getTime() < start.getTime()) {
      cursor = this.addMonthsClamped(cursor, intervalMonths, anchorDay);
    }

    const renewals: Date[] = [];
    while (cursor.getTime() < endExclusive.getTime()) {
      renewals.push(cursor);
      cursor = this.addMonthsClamped(cursor, intervalMonths, anchorDay);
    }
    return renewals;
  }

  private priceAt(
    subscription: ReviewSubscription,
    renewal: Date,
  ): { amountCents: number; currency: string } {
    let amountCents = subscription.billingAmountCents;
    let currency = subscription.billingCurrency;

    for (const event of subscription.events) {
      if (
        event.eventType !== 'price_changed' ||
        event.occurredAt.getTime() <= renewal.getTime()
      ) {
        continue;
      }
      const priceChange = this.parsePriceChange(event);
      if (
        priceChange &&
        priceChange.amountCents === amountCents &&
        priceChange.currency === currency
      ) {
        amountCents = priceChange.previousAmountCents;
        currency = priceChange.previousCurrency;
      }
    }
    return { amountCents, currency };
  }

  private parsePriceChange(event: ReviewEvent): ParsedPriceChange | null {
    if (
      event.previousAmountCents !== null &&
      event.amountCents !== null &&
      event.previousCurrency &&
      event.currency &&
      Number.isFinite(event.previousAmountCents) &&
      Number.isFinite(event.amountCents)
    ) {
      return {
        previousAmountCents: event.previousAmountCents,
        previousCurrency: event.previousCurrency.toUpperCase(),
        amountCents: event.amountCents,
        currency: event.currency.toUpperCase(),
        dataSource: 'structured',
      };
    }

    const legacyMatch = event.notes?.match(
      /Price changed from\s+([A-Z]{3})\s+(\d+(?:\.\d{1,2})?)\s+to\s+([A-Z]{3})\s+(\d+(?:\.\d{1,2})?)/i,
    );
    if (!legacyMatch) {
      return null;
    }
    return {
      previousAmountCents: Math.round(Number(legacyMatch[2]) * 100),
      previousCurrency: legacyMatch[1].toUpperCase(),
      amountCents: Math.round(Number(legacyMatch[4]) * 100),
      currency: legacyMatch[3].toUpperCase(),
      dataSource: 'legacy_note',
    };
  }

  private lastActivityAt(
    subscription: ReviewSubscription,
    asOf: Date,
  ): Date | undefined {
    return [
      subscription.updatedAt,
      subscription.lastImportedAt,
      ...subscription.events.map((event) => event.occurredAt),
    ]
      .filter(
        (value): value is Date =>
          value instanceof Date && value.getTime() <= asOf.getTime(),
      )
      .sort((a, b) => b.getTime() - a.getTime())[0];
  }

  private addMonthsClamped(
    date: Date,
    months: number,
    anchorDay: number,
  ): Date {
    const target = new Date(date);
    target.setUTCDate(1);
    target.setUTCMonth(target.getUTCMonth() + months);
    const lastDay = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
    target.setUTCDate(Math.min(anchorDay, lastDay));
    return target;
  }

  private clamp(value: Date, minimum: Date, maximum: Date): Date {
    if (value.getTime() <= minimum.getTime()) return minimum;
    if (value.getTime() >= maximum.getTime()) return maximum;
    return value;
  }

  private toReportedPeriodEnd(
    periodStart: Date,
    periodEndExclusive: Date,
    yearEndExclusive: Date,
  ): Date {
    if (periodEndExclusive.getTime() <= periodStart.getTime())
      return periodStart;
    if (periodEndExclusive.getTime() === yearEndExclusive.getTime()) {
      return new Date(yearEndExclusive.getTime() - 1);
    }
    return periodEndExclusive;
  }

  private daysBefore(value: Date, days: number): Date {
    return new Date(value.getTime() - days * 24 * 60 * 60 * 1000);
  }

  private minDate(a: Date, b: Date): Date {
    return a.getTime() <= b.getTime() ? a : b;
  }

  private maxDate(a: Date, b: Date): Date {
    return a.getTime() >= b.getTime() ? a : b;
  }
}
