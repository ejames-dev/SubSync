import { DataExportService } from './data-export.service';

describe('DataExportService', () => {
  const prisma = {
    subscription: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.subscription.findMany.mockResolvedValue([
      {
        id: 'sub_1',
        serviceId: 'svc_netflix',
        planName: 'Standard',
        status: 'active',
        billingAmountCents: 1549,
        billingCurrency: 'USD',
        billingInterval: 'monthly',
        nextRenewal: new Date('2026-03-18T00:00:00.000Z'),
        paymentSource: 'card',
        paymentLast4: '4242',
        autoImportSource: 'manual',
        notes: null,
        statusChangedAt: new Date('2026-03-17T00:00:00.000Z'),
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
        updatedAt: new Date('2026-03-17T00:00:00.000Z'),
        service: { name: 'Netflix' },
      },
    ]);
  });

  it('exports subscriptions as JSON', async () => {
    const service = new DataExportService(prisma as never);
    const json = await service.exportSubscriptionsJson();
    const payload = JSON.parse(json);

    expect(payload.subscriptions).toHaveLength(1);
    expect(payload.subscriptions[0]).toEqual(
      expect.objectContaining({
        serviceName: 'Netflix',
        billingAmount: 15.49,
      }),
    );
  });

  it('exports subscriptions as CSV with headers', async () => {
    const service = new DataExportService(prisma as never);
    const csv = await service.exportSubscriptionsCsv();

    expect(csv.split('\n')[0]).toContain('serviceName');
    expect(csv).toContain('Netflix');
    expect(csv).toContain('15.49');
  });
});
