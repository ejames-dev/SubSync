import { Subscription } from '@subscription-tracker/types';
import { DashboardService } from './dashboard.service';

function subscription(
  overrides: Partial<Subscription> & Pick<Subscription, 'id'>,
): Subscription {
  return {
    id: overrides.id,
    serviceId: 'netflix',
    planName: 'Standard',
    status: 'active',
    billingAmount: 10,
    billingCurrency: 'USD',
    billingInterval: 'monthly',
    nextRenewal: '2026-07-20T00:00:00.000Z',
    autoImportSource: 'manual',
    statusChangedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('DashboardService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('builds a currency-safe budget and forecast from known renewal dates', async () => {
    const subscriptions = [
      subscription({ id: 'monthly' }),
      subscription({
        id: 'quarterly',
        billingAmount: 30,
        billingInterval: 'quarterly',
        nextRenewal: '2026-08-01T00:00:00.000Z',
      }),
      subscription({
        id: 'custom',
        billingAmount: 5,
        billingInterval: 'custom',
        nextRenewal: '2026-09-01T00:00:00.000Z',
      }),
      subscription({
        id: 'cad',
        billingAmount: 100,
        billingCurrency: 'CAD',
      }),
      subscription({
        id: 'canceled',
        billingAmount: 100,
        status: 'canceled_pending',
        nextRenewal: '2026-07-16T00:00:00.000Z',
      }),
    ];
    const service = new DashboardService(
      { list: jest.fn().mockResolvedValue(subscriptions) } as never,
      {
        findAll: jest.fn().mockResolvedValue([
          {
            id: 'netflix',
            name: 'Netflix',
            category: 'streaming',
            supportsOAuth: false,
          },
        ]),
      } as never,
      {
        getSettings: jest.fn().mockResolvedValue({
          notificationPreference: {
            id: 'default',
            leadTimeDays: 7,
            channels: ['push'],
          },
          emailForwardingAlias: 'subs@example.com',
          budgetCurrency: 'USD',
          monthlyBudget: {
            amount: 20,
            currency: 'USD',
            alertTriggered: false,
          },
        }),
      } as never,
    );

    const result = await service.getSummary();

    expect(result.budget).toEqual({
      currency: 'USD',
      monthlyEquivalentSpend: 25,
      threshold: 20,
      percentUsed: 125,
      overBudget: true,
      excludedCurrencyCount: 1,
    });
    expect(result.monthlyEquivalentSpend).toBe(25);
    expect(result.spendByCategory).toEqual([
      { category: 'streaming', monthlyEquivalentSpend: 25 },
    ]);
    expect(result.activeSubscriptions).toBe(4);
    expect(result.nextRenewal?.subscriptionId).toBe('monthly');
    expect(result.forecast.total).toBe(65);
    expect(result.forecast.excludedCurrencyCount).toBe(1);
    expect(result.forecast.months).toEqual([
      { month: '2026-07', amount: 10, renewalCount: 1 },
      { month: '2026-08', amount: 40, renewalCount: 2 },
      { month: '2026-09', amount: 15, renewalCount: 2 },
      { month: '2026-10', amount: 0, renewalCount: 0 },
    ]);
  });

  it('forecasts custom billing only once and preserves end-of-month cadence', async () => {
    jest.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
    const service = new DashboardService(
      {
        list: jest.fn().mockResolvedValue([
          subscription({
            id: 'monthly',
            nextRenewal: '2026-01-31T00:00:00.000Z',
          }),
          subscription({
            id: 'custom',
            billingAmount: 4,
            billingInterval: 'custom',
            nextRenewal: '2026-01-20T00:00:00.000Z',
          }),
        ]),
      } as never,
      {
        findAll: jest.fn().mockResolvedValue([
          {
            id: 'netflix',
            name: 'Netflix',
            category: 'streaming',
            supportsOAuth: false,
          },
        ]),
      } as never,
      {
        getSettings: jest.fn().mockResolvedValue({
          notificationPreference: {
            id: 'default',
            leadTimeDays: 7,
            channels: ['push'],
          },
          emailForwardingAlias: 'subs@example.com',
          budgetCurrency: 'USD',
        }),
      } as never,
    );

    const result = await service.getSummary();

    expect(result.forecast.total).toBe(34);
    expect(result.forecast.months.map((month) => month.amount)).toEqual([
      14, 10, 10, 0,
    ]);
  });
});
