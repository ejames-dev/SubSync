import { Injectable } from '@nestjs/common';
import { DashboardSummary, Subscription } from '@subscription-tracker/types';
import {
  addMonthsClampedUtc,
  advanceRenewalDate,
  isBillableStatus,
  toMonthlyEquivalent,
} from '../common/billing-interval.util';
import { ServiceCatalogService } from '../service-catalog/service-catalog.service';
import { SettingsService } from '../settings/settings.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly serviceCatalog: ServiceCatalogService,
    private readonly settings: SettingsService,
  ) {}

  async getSummary(): Promise<DashboardSummary> {
    const [services, subscriptions, settings] = await Promise.all([
      this.serviceCatalog.findAll(),
      this.subscriptions.list(),
      this.settings.getSettings(),
    ]);
    const servicesById = Object.fromEntries(
      services.map((service) => [service.id, service]),
    );
    const billableSubscriptions = subscriptions.filter((s) =>
      isBillableStatus(s.status),
    );
    const ordered = billableSubscriptions
      .slice()
      .sort((a, b) => a.nextRenewal.localeCompare(b.nextRenewal));
    const budgetCurrency = settings.budgetCurrency?.toUpperCase() ?? 'USD';
    const budgetSubscriptions = billableSubscriptions.filter(
      (subscription) =>
        subscription.billingCurrency.toUpperCase() === budgetCurrency,
    );
    const budgetMonthlySpend = this.roundCurrency(
      budgetSubscriptions.reduce(
        (sum, subscription) =>
          sum +
          toMonthlyEquivalent(
            subscription.billingAmount,
            subscription.billingInterval,
            subscription.customIntervalDays,
          ),
        0,
      ),
    );
    const budgetThreshold = settings.monthlyBudget?.amount;

    const sourceBreakdown: DashboardSummary['sourceBreakdown'] = {
      manual: 0,
      email: 0,
      oauth: 0,
    };

    for (const subscription of subscriptions) {
      const source = subscription.autoImportSource ?? 'manual';
      sourceBreakdown[source] += 1;
    }

    const spendByCategoryMap = new Map<string, number>();
    for (const subscription of budgetSubscriptions) {
      const category =
        servicesById[subscription.serviceId]?.category ?? 'other';
      spendByCategoryMap.set(
        category,
        (spendByCategoryMap.get(category) ?? 0) +
          toMonthlyEquivalent(
            subscription.billingAmount,
            subscription.billingInterval,
            subscription.customIntervalDays,
          ),
      );
    }

    const duplicateMap = new Map<string, Subscription[]>();
    for (const subscription of billableSubscriptions) {
      duplicateMap.set(subscription.serviceId, [
        ...(duplicateMap.get(subscription.serviceId) ?? []),
        subscription,
      ]);
    }

    return {
      monthlyEquivalentSpend: budgetMonthlySpend,
      activeSubscriptions: billableSubscriptions.length,
      upcomingRenewalCount: billableSubscriptions.filter((subscription) =>
        this.isWithinDays(subscription.nextRenewal, 14),
      ).length,
      nextRenewal: ordered[0]
        ? {
            subscriptionId: ordered[0].id,
            serviceId: ordered[0].serviceId,
            serviceName:
              servicesById[ordered[0].serviceId]?.name ?? ordered[0].serviceId,
            nextRenewal: ordered[0].nextRenewal,
          }
        : undefined,
      sourceBreakdown,
      spendByCategory: Array.from(spendByCategoryMap.entries())
        .map(([category, monthlyEquivalentSpend]) => ({
          category:
            category as DashboardSummary['spendByCategory'][number]['category'],
          monthlyEquivalentSpend: this.roundCurrency(monthlyEquivalentSpend),
        }))
        .sort((a, b) => b.monthlyEquivalentSpend - a.monthlyEquivalentSpend),
      duplicateSubscriptions: Array.from(duplicateMap.entries())
        .filter(
          ([, group]) =>
            group.length > 1 &&
            group.some((subscription) => !subscription.duplicateReviewedAt),
        )
        .map(([serviceId, group]) => ({
          serviceId,
          serviceName: servicesById[serviceId]?.name ?? serviceId,
          count: group.length,
          subscriptionIds: group.map((subscription) => subscription.id),
        }))
        .sort(
          (a, b) =>
            b.count - a.count || a.serviceName.localeCompare(b.serviceName),
        ),
      budget: {
        currency: budgetCurrency,
        monthlyEquivalentSpend: budgetMonthlySpend,
        threshold: budgetThreshold,
        percentUsed:
          budgetThreshold === undefined
            ? undefined
            : Math.round((budgetMonthlySpend / budgetThreshold) * 1000) / 10,
        overBudget:
          budgetThreshold !== undefined &&
          budgetMonthlySpend >= budgetThreshold,
        excludedCurrencyCount:
          billableSubscriptions.length - budgetSubscriptions.length,
      },
      forecast: this.buildForecast(
        budgetSubscriptions,
        budgetCurrency,
        billableSubscriptions.length - budgetSubscriptions.length,
      ),
    };
  }

  private buildForecast(
    subscriptions: Subscription[],
    currency: string,
    excludedCurrencyCount: number,
  ): DashboardSummary['forecast'] {
    const horizonStart = new Date();
    const horizonEnd = addMonthsClampedUtc(horizonStart, 3);
    const months = new Map<
      string,
      { amountCents: number; renewalCount: number }
    >();

    let monthCursor = new Date(
      Date.UTC(horizonStart.getUTCFullYear(), horizonStart.getUTCMonth(), 1),
    );
    while (monthCursor < horizonEnd) {
      months.set(this.monthKey(monthCursor), {
        amountCents: 0,
        renewalCount: 0,
      });
      monthCursor = addMonthsClampedUtc(monthCursor, 1, 1);
    }

    for (const subscription of subscriptions) {
      const renewalAnchor = new Date(subscription.nextRenewal);
      if (Number.isNaN(renewalAnchor.getTime())) {
        continue;
      }

      if (
        subscription.billingInterval === 'custom' &&
        (!subscription.customIntervalDays ||
          subscription.customIntervalDays <= 0)
      ) {
        if (renewalAnchor >= horizonStart && renewalAnchor < horizonEnd) {
          this.addForecastRenewal(
            months,
            renewalAnchor,
            this.chargeAmountForStep(subscription, 0),
          );
        }
        continue;
      }

      const anchorDay = renewalAnchor.getUTCDate();
      let step = 0;
      let renewal: Date | null = renewalAnchor;
      while (renewal && renewal < horizonStart && step < 520) {
        step += 1;
        renewal = advanceRenewalDate(
          renewalAnchor,
          subscription.billingInterval,
          step,
          subscription.customIntervalDays,
          anchorDay,
        );
      }
      while (renewal && renewal < horizonEnd && step < 520) {
        this.addForecastRenewal(
          months,
          renewal,
          this.chargeAmountForStep(subscription, step),
        );
        step += 1;
        renewal = advanceRenewalDate(
          renewalAnchor,
          subscription.billingInterval,
          step,
          subscription.customIntervalDays,
          anchorDay,
        );
      }
    }

    const forecastMonths = Array.from(months.entries()).map(
      ([month, value]) => ({
        month,
        amount: value.amountCents / 100,
        renewalCount: value.renewalCount,
      }),
    );

    return {
      currency,
      total: this.roundCurrency(
        forecastMonths.reduce((total, month) => total + month.amount, 0),
      ),
      horizonStart: horizonStart.toISOString(),
      horizonEnd: horizonEnd.toISOString(),
      excludedCurrencyCount,
      months: forecastMonths,
    };
  }

  private chargeAmountForStep(
    subscription: Subscription,
    step: number,
  ): number {
    if (
      subscription.status === 'trial' &&
      subscription.postTrialAmount !== undefined
    ) {
      const trialEnd = subscription.trialEndsAt
        ? new Date(subscription.trialEndsAt)
        : new Date(subscription.nextRenewal);
      const anchor = new Date(subscription.nextRenewal);
      if (step > 0 || anchor >= trialEnd) {
        return subscription.postTrialAmount;
      }
    }
    return subscription.billingAmount;
  }

  private addForecastRenewal(
    months: Map<string, { amountCents: number; renewalCount: number }>,
    renewal: Date,
    amount: number,
  ) {
    const key = this.monthKey(renewal);
    const current = months.get(key) ?? { amountCents: 0, renewalCount: 0 };
    current.amountCents += Math.round(amount * 100);
    current.renewalCount += 1;
    months.set(key, current);
  }

  private monthKey(value: Date): string {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private isWithinDays(value: string, days: number): boolean {
    const renewal = new Date(value).getTime();
    const now = Date.now();
    const windowMs = days * 24 * 60 * 60 * 1000;
    return renewal >= now && renewal <= now + windowMs;
  }

  private roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
