import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceCatalogService } from '../service-catalog/service-catalog.service';

type PrismaMock = {
  $transaction: jest.Mock;
  subscription: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  subscriptionEvent: {
    create: jest.Mock;
    findMany: jest.Mock;
    updateMany: jest.Mock;
  };
  pendingNotification: {
    create: jest.Mock;
    updateMany: jest.Mock;
  };
  emailReceiptItem: {
    updateMany: jest.Mock;
  };
};

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: PrismaMock;
  let serviceCatalog: jest.Mocked<Pick<ServiceCatalogService, 'ensureExists'>>;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      subscription: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      subscriptionEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      pendingNotification: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      emailReceiptItem: {
        updateMany: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation((callback) => callback(prisma));

    serviceCatalog = {
      ensureExists: jest
        .fn()
        .mockResolvedValue({ id: 'svc_spotify', name: 'Spotify' }),
    };

    service = new SubscriptionsService(
      prisma as unknown as PrismaService,
      serviceCatalog as unknown as ServiceCatalogService,
    );
  });

  const subscriptionEntity = () => ({
    id: 'sub_1',
    serviceId: 'svc_spotify',
    planName: 'Premium',
    status: 'active',
    billingAmountCents: 1500,
    billingCurrency: 'USD',
    billingInterval: 'monthly',
    nextRenewal: new Date('2026-04-01T00:00:00.000Z'),
    paymentSource: 'card',
    paymentLast4: '4242',
    autoImportSource: 'manual',
    notes: null,
    nextRenewalReminderSent: false,
    statusChangedAt: new Date('2026-03-01T00:00:00.000Z'),
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    importKey: null,
    lastImportedAt: null,
  });

  it('creates subscriptions and records an event', async () => {
    const entity = subscriptionEntity();
    prisma.subscription.create.mockResolvedValue(entity);

    const dto = {
      serviceId: 'svc_spotify',
      planName: 'Premium',
      billingAmount: 15,
      billingCurrency: 'USD',
      billingInterval: 'monthly' as const,
      nextRenewal: '2026-04-01',
    };

    const result = await service.create(dto);

    expect(prisma.subscription.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        planName: 'Premium',
        status: 'active',
      }),
    });
    expect(prisma.subscriptionEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subscriptionId: 'sub_1',
        eventType: 'created',
        status: 'active',
      }),
    });
    expect(result.id).toBe('sub_1');
    expect(result.status).toBe('active');
    expect(result.billingAmount).toBe(15);
  });

  it('records a status change event during update', async () => {
    const entity = subscriptionEntity();
    prisma.subscription.findUnique.mockResolvedValue(entity);
    prisma.subscription.update.mockResolvedValue({
      ...entity,
      status: 'trial',
      statusChangedAt: new Date('2026-03-10T00:00:00.000Z'),
    });

    const result = await service.update('sub_1', { status: 'trial' });

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub_1' },
      data: expect.objectContaining({
        status: 'trial',
        statusChangedAt: expect.any(Date),
      }),
    });
    expect(prisma.subscriptionEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subscriptionId: 'sub_1',
        eventType: 'status_changed',
        status: 'trial',
      }),
    });
    expect(result.status).toBe('trial');
  });

  it('records a structured price event during a manual edit', async () => {
    const entity = subscriptionEntity();
    prisma.subscription.findUnique.mockResolvedValue(entity);
    prisma.subscription.update.mockResolvedValue({
      ...entity,
      billingAmountCents: 1750,
    });

    await service.update('sub_1', { billingAmount: 17.5 });

    expect(prisma.subscriptionEvent.create).toHaveBeenCalledWith({
      data: {
        subscriptionId: 'sub_1',
        eventType: 'price_changed',
        status: 'active',
        notes: 'Price changed from USD 15.00 to USD 17.50 via manual edit',
        previousAmountCents: 1500,
        previousCurrency: 'USD',
        amountCents: 1750,
        currency: 'USD',
      },
    });
  });

  it('returns mapped subscription events', async () => {
    const entity = subscriptionEntity();
    prisma.subscription.findUnique.mockResolvedValue(entity);
    prisma.subscriptionEvent.findMany.mockResolvedValue([
      {
        id: 'evt_1',
        subscriptionId: 'sub_1',
        eventType: 'created',
        status: 'active',
        notes: null,
        previousAmountCents: null,
        previousCurrency: null,
        amountCents: null,
        currency: null,
        occurredAt: new Date('2026-03-01T00:00:00.000Z'),
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    ]);

    const events = await service.listEvents('sub_1');

    expect(prisma.subscriptionEvent.findMany).toHaveBeenCalledWith({
      where: { subscriptionId: 'sub_1' },
      orderBy: { occurredAt: 'desc' },
    });
    expect(events).toEqual([
      {
        id: 'evt_1',
        subscriptionId: 'sub_1',
        eventType: 'created',
        status: 'active',
        notes: undefined,
        occurredAt: '2026-03-01T00:00:00.000Z',
      },
    ]);
  });

  it('returns recent events with a limit', async () => {
    prisma.subscriptionEvent.findMany.mockResolvedValue([
      {
        id: 'evt_2',
        subscriptionId: 'sub_1',
        eventType: 'status_changed',
        status: 'trial',
        notes: null,
        previousAmountCents: null,
        previousCurrency: null,
        amountCents: null,
        currency: null,
        occurredAt: new Date('2026-03-05T00:00:00.000Z'),
        createdAt: new Date('2026-03-05T00:00:00.000Z'),
      },
    ]);

    const events = await service.recentEvents(2);

    expect(prisma.subscriptionEvent.findMany).toHaveBeenCalledWith({
      orderBy: { occurredAt: 'desc' },
      take: 2,
    });
    expect(events[0]).toEqual({
      id: 'evt_2',
      subscriptionId: 'sub_1',
      eventType: 'status_changed',
      status: 'trial',
      notes: undefined,
      occurredAt: '2026-03-05T00:00:00.000Z',
    });
  });

  it('records and returns an imported price change', async () => {
    const existing = subscriptionEntity();
    prisma.subscription.findFirst.mockResolvedValue(existing);
    prisma.subscription.update.mockResolvedValue({
      ...existing,
      billingAmountCents: 1799,
      autoImportSource: 'email',
    });

    const result = await service.upsertImported({
      serviceId: 'svc_spotify',
      planName: 'Premium',
      billingAmount: 17.99,
      billingCurrency: 'USD',
      billingInterval: 'monthly',
      nextRenewal: '2026-05-01T00:00:00.000Z',
      autoImportSource: 'email',
      priceChangeNotification: {
        channels: ['push', 'email'],
        title: 'Spotify price changed',
      },
    });

    expect(prisma.subscriptionEvent.create).toHaveBeenCalledWith({
      data: {
        subscriptionId: 'sub_1',
        eventType: 'price_changed',
        status: 'active',
        notes: 'Price changed from USD 15.00 to USD 17.99 via email import',
        previousAmountCents: 1500,
        previousCurrency: 'USD',
        amountCents: 1799,
        currency: 'USD',
      },
    });
    expect(result.priceChange).toEqual({
      previousAmount: 15,
      previousCurrency: 'USD',
      newAmount: 17.99,
      newCurrency: 'USD',
    });
    expect(prisma.pendingNotification.create).toHaveBeenCalledTimes(2);
  });

  it('does not record a price change when an imported price is unchanged', async () => {
    const existing = subscriptionEntity();
    prisma.subscription.findFirst.mockResolvedValue(existing);
    prisma.subscription.update.mockResolvedValue({
      ...existing,
      autoImportSource: 'email',
    });

    const result = await service.upsertImported({
      serviceId: 'svc_spotify',
      planName: 'Premium',
      billingAmount: 15,
      billingCurrency: 'USD',
      billingInterval: 'monthly',
      nextRenewal: '2026-05-01T00:00:00.000Z',
      autoImportSource: 'email',
    });

    expect(prisma.subscriptionEvent.create).not.toHaveBeenCalled();
    expect(result.priceChange).toBeUndefined();
  });

  it('preserves a cancellation flag when a new receipt is imported', async () => {
    const existing = {
      ...subscriptionEntity(),
      status: 'flagged_for_cancellation',
    };
    prisma.subscription.findFirst.mockResolvedValue(existing);
    prisma.subscription.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...existing, ...data, autoImportSource: 'email' }),
    );

    const result = await service.upsertImported({
      serviceId: 'svc_spotify',
      planName: 'Premium',
      billingAmount: 15,
      billingCurrency: 'USD',
      billingInterval: 'monthly',
      nextRenewal: '2026-05-01T00:00:00.000Z',
      autoImportSource: 'email',
    });

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub_1' },
      data: expect.objectContaining({ status: 'flagged_for_cancellation' }),
    });
    expect(result.subscription.status).toBe('flagged_for_cancellation');
  });

  it('ignores an older receipt instead of rolling a subscription backward', async () => {
    const existing = {
      ...subscriptionEntity(),
      lastImportedAt: new Date('2026-06-01T00:00:00.000Z'),
    };
    prisma.subscription.findFirst.mockResolvedValue(existing);

    const result = await service.upsertImported({
      serviceId: 'svc_spotify',
      planName: 'Premium',
      billingAmount: 12,
      billingCurrency: 'USD',
      billingInterval: 'monthly',
      nextRenewal: '2026-05-01T00:00:00.000Z',
      observedAt: '2026-05-01T00:00:00.000Z',
      importKey: 'spotify:account',
      autoImportSource: 'email',
    });

    expect(result.mode).toBe('ignored');
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(prisma.subscriptionEvent.create).not.toHaveBeenCalled();
  });

  it('uses a stable import key before falling back to plan-name matching', async () => {
    prisma.subscription.findFirst.mockResolvedValue(null);
    prisma.subscription.create.mockResolvedValue({
      ...subscriptionEntity(),
      importKey: 'spotify:account',
      lastImportedAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    await service.upsertImported({
      serviceId: 'svc_spotify',
      planName: 'Spotify Individual',
      billingAmount: 15,
      billingCurrency: 'USD',
      billingInterval: 'monthly',
      nextRenewal: '2026-07-01T00:00:00.000Z',
      observedAt: '2026-06-01T00:00:00.000Z',
      importKey: 'spotify:account',
      autoImportSource: 'email',
    });

    expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
      where: { importKey: 'spotify:account' },
    });
  });

  it('throws when subscription is missing', async () => {
    prisma.subscription.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  describe('duplicate review', () => {
    it('marks every subscription in a duplicate group as reviewed', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        { id: 'sub_1' },
        { id: 'sub_2' },
      ]);
      prisma.subscription.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.dismissDuplicates('svc_spotify');

      expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { serviceId: 'svc_spotify' },
        data: { duplicateReviewedAt: expect.any(Date) },
      });
      expect(result).toEqual({ serviceId: 'svc_spotify', dismissedCount: 2 });
    });

    it('refuses to dismiss a service without duplicates', async () => {
      prisma.subscription.findMany.mockResolvedValue([{ id: 'sub_1' }]);

      await expect(service.dismissDuplicates('svc_spotify')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
    });

    it('moves history onto the kept subscription and deletes the rest', async () => {
      const kept = subscriptionEntity();
      const removed = {
        ...subscriptionEntity(),
        id: 'sub_2',
        planName: 'Premium (email)',
        autoImportSource: 'email',
        importKey: 'spotify:account',
        lastImportedAt: new Date('2026-06-01T00:00:00.000Z'),
      };
      prisma.subscription.findUnique.mockResolvedValue(kept);
      prisma.subscription.findMany.mockResolvedValue([removed]);
      prisma.subscription.update.mockResolvedValue({
        ...kept,
        importKey: removed.importKey,
        lastImportedAt: removed.lastImportedAt,
      });

      const result = await service.mergeDuplicates({
        keepId: 'sub_1',
        removeIds: ['sub_2'],
      });

      const reassign = {
        where: { subscriptionId: { in: ['sub_2'] } },
        data: { subscriptionId: 'sub_1' },
      };
      expect(prisma.subscriptionEvent.updateMany).toHaveBeenCalledWith(
        reassign,
      );
      expect(prisma.emailReceiptItem.updateMany).toHaveBeenCalledWith(reassign);
      expect(prisma.pendingNotification.updateMany).toHaveBeenCalledWith(
        reassign,
      );
      expect(prisma.subscription.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['sub_2'] } },
      });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub_1' },
        data: {
          importKey: 'spotify:account',
          lastImportedAt: removed.lastImportedAt,
        },
      });
      expect(
        prisma.subscription.deleteMany.mock.invocationCallOrder[0],
      ).toBeLessThan(prisma.subscription.update.mock.invocationCallOrder[0]);
      expect(prisma.subscriptionEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          subscriptionId: 'sub_1',
          eventType: 'merged',
          notes: 'Merged 1 duplicate entry: Premium (email)',
        }),
      });
      expect(result.id).toBe('sub_1');
    });

    it('keeps the existing import key when the kept subscription has one', async () => {
      const kept = { ...subscriptionEntity(), importKey: 'spotify:primary' };
      prisma.subscription.findUnique.mockResolvedValue(kept);
      prisma.subscription.findMany.mockResolvedValue([
        { ...subscriptionEntity(), id: 'sub_2', importKey: 'spotify:other' },
      ]);
      prisma.subscription.update.mockResolvedValue(kept);

      await service.mergeDuplicates({ keepId: 'sub_1', removeIds: ['sub_2'] });

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub_1' },
        data: {},
      });
    });

    it('rejects merging subscriptions from different services', async () => {
      prisma.subscription.findUnique.mockResolvedValue(subscriptionEntity());
      prisma.subscription.findMany.mockResolvedValue([
        { ...subscriptionEntity(), id: 'sub_2', serviceId: 'svc_netflix' },
      ]);

      await expect(
        service.mergeDuplicates({ keepId: 'sub_1', removeIds: ['sub_2'] }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.subscription.deleteMany).not.toHaveBeenCalled();
    });

    it('rejects removing the kept subscription', async () => {
      await expect(
        service.mergeDuplicates({ keepId: 'sub_1', removeIds: ['sub_1'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('reports subscriptions that no longer exist', async () => {
      prisma.subscription.findUnique.mockResolvedValue(subscriptionEntity());
      prisma.subscription.findMany.mockResolvedValue([]);

      await expect(
        service.mergeDuplicates({ keepId: 'sub_1', removeIds: ['sub_2'] }),
      ).rejects.toThrow('Subscriptions not found: sub_2');
    });
  });
});
