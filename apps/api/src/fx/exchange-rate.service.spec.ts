import { DashboardService } from '../dashboard/dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExchangeRateService } from './exchange-rate.service';

describe('ExchangeRateService & Dashboard FX / Family Splitting', () => {
  it('converts currencies via USD pivot and respects manual overrides', async () => {
    const prisma = {
      exchangeRate: {
        findMany: jest.fn().mockResolvedValue([
          {
            currency: 'EUR',
            rateToUsd: 1.2,
            isManualOverride: true,
            updatedAt: new Date('2026-11-19T00:00:00.000Z'),
          },
        ]),
        upsert: jest.fn().mockResolvedValue({
          currency: 'CAD',
          rateToUsd: 0.75,
          isManualOverride: true,
          updatedAt: new Date('2026-11-19T00:00:00.000Z'),
        }),
      },
    };

    const fx = new ExchangeRateService(prisma as unknown as PrismaService);
    const rateMap = await fx.getRateMap();

    expect(fx.convert(10, 'EUR', 'USD', rateMap)).toBeCloseTo(12, 4);
    expect(fx.convert(100, 'XYZ', 'USD', rateMap)).toBeNull();

    const saved = await fx.upsertManualRate('cad', 0.75);
    expect(saved).toEqual(
      expect.objectContaining({
        currency: 'CAD',
        rateToUsd: 0.75,
        isManualOverride: true,
      }),
    );
  });

  it('normalizes multi-currency spend, computes family seat personal share, and suppresses bundle duplicates', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
    try {
      const fxPrisma = {
        exchangeRate: {
          findMany: jest.fn().mockResolvedValue([
            {
              currency: 'EUR',
              rateToUsd: 1.1,
              isManualOverride: true,
              updatedAt: new Date('2026-07-15T00:00:00.000Z'),
            },
          ]),
        },
      };
      const fx = new ExchangeRateService(fxPrisma as unknown as PrismaService);

      const subscriptions = [
        {
          id: 'sub_family',
          serviceId: 'svc_spotify',
          planName: 'Family',
          status: 'active' as const,
          billingAmount: 18,
          billingCurrency: 'USD',
          billingInterval: 'monthly' as const,
          totalSeats: 6,
          sharedSeats: 4,
          nextRenewal: '2026-07-20T00:00:00.000Z',
          statusChangedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'sub_eur',
          serviceId: 'svc_netflix',
          planName: 'Standard',
          status: 'active' as const,
          billingAmount: 10,
          billingCurrency: 'EUR',
          billingInterval: 'monthly' as const,
          nextRenewal: '2026-07-25T00:00:00.000Z',
          statusChangedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'sub_bundled_child',
          serviceId: 'svc_spotify',
          planName: 'Bundled Child',
          status: 'active' as const,
          billingAmount: 0,
          billingCurrency: 'USD',
          billingInterval: 'monthly' as const,
          bundleParentId: 'sub_bundle_root',
          nextRenewal: '2026-07-20T00:00:00.000Z',
          statusChangedAt: '2026-01-01T00:00:00.000Z',
        },
      ];

      const dashboard = new DashboardService(
        { list: jest.fn().mockResolvedValue(subscriptions) } as never,
        {
          findAll: jest.fn().mockResolvedValue([
            {
              id: 'svc_spotify',
              name: 'Spotify',
              category: 'music',
              supportsOAuth: true,
            },
            {
              id: 'svc_netflix',
              name: 'Netflix',
              category: 'streaming',
              supportsOAuth: false,
            },
          ]),
        } as never,
        {
          getSettings: jest.fn().mockResolvedValue({
            budgetCurrency: 'USD',
            notificationPreference: {
              id: 'default',
              leadTimeDays: 7,
              channels: ['push'],
            },
            emailForwardingAlias: 'subs+general@subsync.app',
          }),
        } as never,
        fx,
      );

      const summary = await dashboard.getSummary();

      // Personal share of $18 with 2/6 seats kept = $6.00 + €10 * 1.1 = $11.00 => $17.00 net
      expect(summary.monthlyEquivalentSpend).toBe(17);
      // Gross card outflow = $18 + $11 = $29
      expect(summary.grossMonthlyEquivalentSpend).toBe(29);
      expect(summary.convertedCurrencyCount).toBe(1);
      expect(summary.budget.excludedCurrencyCount).toBe(0);
      // Bundled child should not trigger a duplicate group with sub_family
      expect(summary.duplicateSubscriptions).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });
});
