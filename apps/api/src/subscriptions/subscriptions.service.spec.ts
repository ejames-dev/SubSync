import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  subscription: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  subscriptionEvent: {
    create: jest.Mock;
    findMany: jest.Mock;
  };
};

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      subscription: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      subscriptionEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    service = new SubscriptionsService(prisma as unknown as PrismaService);
  });

  const subscriptionEntity = () => ({
    id: 'sub_1',
    serviceId: 'svc_spotify',
    planName: 'Premium',
    status: 'active',
    billingAmount: new Prisma.Decimal(15),
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

  it('throws when subscription is missing', async () => {
    prisma.subscription.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });
});
