import { Injectable } from '@nestjs/common';
import { DashboardSummary, Subscription } from '@subscription-tracker/types';
import { ServiceCatalogService } from '../service-catalog/service-catalog.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly serviceCatalog: ServiceCatalogService,
  ) {}

  async getSummary(): Promise<DashboardSummary> {
    const [services, subscriptions] = await Promise.all([
      this.serviceCatalog.findAll(),
      this.subscriptions.list(),
    ]);
    const servicesById = Object.fromEntries(
      services.map((service) => [service.id, service]),
    );
    const ordered = subscriptions
      .slice()
      .sort((a, b) => a.nextRenewal.localeCompare(b.nextRenewal));
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
    for (const subscription of subscriptions) {
      const category =
        servicesById[subscription.serviceId]?.category ?? 'other';
      spendByCategoryMap.set(
        category,
        (spendByCategoryMap.get(category) ?? 0) +
          this.toMonthlyEquivalent(subscription),
      );
    }

    const duplicateMap = new Map<string, number>();
    for (const subscription of subscriptions) {
      duplicateMap.set(
        subscription.serviceId,
        (duplicateMap.get(subscription.serviceId) ?? 0) + 1,
      );
    }

    return {
      monthlyEquivalentSpend: this.roundCurrency(
        subscriptions.reduce(
          (sum, subscription) => sum + this.toMonthlyEquivalent(subscription),
          0,
        ),
      ),
      activeSubscriptions: subscriptions.length,
      upcomingRenewalCount: subscriptions.filter((subscription) =>
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
        .filter(([, count]) => count > 1)
        .map(([serviceId, count]) => ({
          serviceId,
          serviceName: servicesById[serviceId]?.name ?? serviceId,
          count,
        }))
        .sort(
          (a, b) =>
            b.count - a.count || a.serviceName.localeCompare(b.serviceName),
        ),
    };
  }

  private toMonthlyEquivalent(subscription: Subscription): number {
    switch (subscription.billingInterval) {
      case 'yearly':
        return subscription.billingAmount / 12;
      case 'quarterly':
        return subscription.billingAmount / 3;
      case 'custom':
        return subscription.billingAmount;
      case 'monthly':
      default:
        return subscription.billingAmount;
    }
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
