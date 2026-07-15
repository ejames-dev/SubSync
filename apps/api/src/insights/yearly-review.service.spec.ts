import { YearlyReviewService } from './yearly-review.service';

describe('YearlyReviewService', () => {
  const prisma = {
    subscription: {
      findMany: jest.fn(),
    },
  };

  const baseSubscription = {
    id: 'sub_netflix',
    serviceId: 'svc_netflix',
    planName: 'Standard',
    status: 'active',
    billingAmountCents: 1300,
    billingCurrency: 'USD',
    billingInterval: 'monthly',
    nextRenewal: new Date('2026-07-01T00:00:00.000Z'),
    statusChangedAt: new Date('2025-12-01T00:00:00.000Z'),
    createdAt: new Date('2025-12-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    lastImportedAt: new Date('2026-06-01T00:00:00.000Z'),
    service: { name: 'Netflix' },
    events: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('estimates renewals by currency and reconstructs earlier prices', async () => {
    prisma.subscription.findMany.mockResolvedValue([
      {
        ...baseSubscription,
        events: [
          {
            eventType: 'price_changed',
            notes: null,
            occurredAt: new Date('2026-03-15T00:00:00.000Z'),
            previousAmountCents: 1000,
            previousCurrency: 'USD',
            amountCents: 1300,
            currency: 'USD',
          },
        ],
      },
      {
        ...baseSubscription,
        id: 'sub_music',
        serviceId: 'svc_music',
        planName: 'Family',
        billingAmountCents: 3000,
        billingCurrency: 'EUR',
        billingInterval: 'quarterly',
        nextRenewal: new Date('2026-07-10T00:00:00.000Z'),
        service: { name: 'Music' },
        events: [],
      },
    ]);

    const review = await new YearlyReviewService(prisma as never).getReview(
      2026,
      new Date('2026-06-15T00:00:00.000Z'),
    );

    expect(review.spendByCurrency).toEqual([
      {
        currency: 'EUR',
        amount: 60,
        renewalCount: 2,
        subscriptionCount: 1,
      },
      {
        currency: 'USD',
        amount: 69,
        renewalCount: 6,
        subscriptionCount: 1,
      },
    ]);
    expect(review.isEstimate).toBe(true);
    expect(review.periodEnd).toBe('2026-06-15T00:00:00.000Z');
  });

  it('ranks same-currency structured and legacy price increases', async () => {
    prisma.subscription.findMany.mockResolvedValue([
      {
        ...baseSubscription,
        billingAmountCents: 1500,
        events: [
          {
            eventType: 'price_changed',
            notes: null,
            occurredAt: new Date('2026-05-01T00:00:00.000Z'),
            previousAmountCents: 1300,
            previousCurrency: 'USD',
            amountCents: 1500,
            currency: 'USD',
          },
          {
            eventType: 'price_changed',
            notes: 'Price changed from USD 10.00 to USD 13.00 via email import',
            occurredAt: new Date('2026-03-01T00:00:00.000Z'),
            previousAmountCents: null,
            previousCurrency: null,
            amountCents: null,
            currency: null,
          },
          {
            eventType: 'price_changed',
            notes: null,
            occurredAt: new Date('2026-02-01T00:00:00.000Z'),
            previousAmountCents: 1200,
            previousCurrency: 'CAD',
            amountCents: 1300,
            currency: 'USD',
          },
        ],
      },
    ]);

    const review = await new YearlyReviewService(prisma as never).getReview(
      2026,
      new Date('2026-12-01T00:00:00.000Z'),
    );

    expect(review.biggestPriceIncreases).toHaveLength(2);
    expect(review.biggestPriceIncreases[0]).toEqual(
      expect.objectContaining({
        increaseAmount: 3,
        currency: 'USD',
        dataSource: 'legacy_note',
      }),
    );
    expect(review.biggestPriceIncreases[1]).toEqual(
      expect.objectContaining({
        increaseAmount: 2,
        increasePercent: 15.4,
        dataSource: 'structured',
      }),
    );
  });

  it('keeps estimated spend in the currency recorded at each renewal', async () => {
    prisma.subscription.findMany.mockResolvedValue([
      {
        ...baseSubscription,
        events: [
          {
            eventType: 'price_changed',
            notes: null,
            occurredAt: new Date('2026-03-15T00:00:00.000Z'),
            previousAmountCents: 1200,
            previousCurrency: 'CAD',
            amountCents: 1300,
            currency: 'USD',
          },
        ],
      },
    ]);

    const review = await new YearlyReviewService(prisma as never).getReview(
      2026,
      new Date('2026-06-15T00:00:00.000Z'),
    );

    expect(review.spendByCurrency).toEqual([
      {
        currency: 'CAD',
        amount: 36,
        renewalCount: 3,
        subscriptionCount: 1,
      },
      {
        currency: 'USD',
        amount: 39,
        renewalCount: 3,
        subscriptionCount: 1,
      },
    ]);
    expect(review.biggestPriceIncreases).toEqual([]);
  });

  it('labels overdue and stale tracking as low-confidence review signals', async () => {
    prisma.subscription.findMany.mockResolvedValue([
      {
        ...baseSubscription,
        id: 'sub_overdue',
        nextRenewal: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-07-01T00:00:00.000Z'),
      },
      {
        ...baseSubscription,
        id: 'sub_stale',
        nextRenewal: new Date('2026-08-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        lastImportedAt: null,
        events: [],
      },
      {
        ...baseSubscription,
        id: 'sub_canceling',
        status: 'canceled_pending',
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
        lastImportedAt: null,
      },
    ]);

    const review = await new YearlyReviewService(prisma as never).getReview(
      2026,
      new Date('2026-07-15T00:00:00.000Z'),
    );

    expect(review.reviewSignals).toEqual([
      expect.objectContaining({
        subscriptionId: 'sub_overdue',
        reason: 'overdue_renewal',
        confidence: 'low',
      }),
      expect.objectContaining({
        subscriptionId: 'sub_stale',
        reason: 'stale_tracking_data',
        confidence: 'low',
      }),
    ]);
  });
});
