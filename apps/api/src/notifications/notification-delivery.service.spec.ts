import { NotificationDeliveryService } from './notification-delivery.service';

describe('NotificationDeliveryService', () => {
  const prisma = {
    pendingNotification: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const record = (id: string) => ({
    id,
    subscriptionId: 'sub_1',
    channel: 'push',
    title: 'Netflix renews soon',
    body: 'Standard renews soon',
    deliveredAt: null,
    createdAt: new Date('2026-03-17T00:00:00.000Z'),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('claims each pending notification with a conditional update', async () => {
    prisma.pendingNotification.findMany.mockResolvedValue([
      record('notif_1'),
      record('notif_2'),
    ]);
    prisma.pendingNotification.updateMany.mockResolvedValue({ count: 1 });

    const service = new NotificationDeliveryService(prisma as never);
    const claimed = await service.claimPending('push');

    expect(claimed.map((item) => item.id)).toEqual(['notif_1', 'notif_2']);
    expect(prisma.pendingNotification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notif_1', deliveredAt: null },
      data: { deliveredAt: expect.any(Date) },
    });
  });

  it('skips notifications another poller claimed first', async () => {
    prisma.pendingNotification.findMany.mockResolvedValue([
      record('notif_1'),
      record('notif_2'),
    ]);
    prisma.pendingNotification.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const service = new NotificationDeliveryService(prisma as never);
    const claimed = await service.claimPending('push');

    expect(claimed.map((item) => item.id)).toEqual(['notif_2']);
  });

  it('returns nothing to claim when the queue is empty', async () => {
    prisma.pendingNotification.findMany.mockResolvedValue([]);

    const service = new NotificationDeliveryService(prisma as never);

    await expect(service.claimPending('push')).resolves.toEqual([]);
    expect(prisma.pendingNotification.updateMany).not.toHaveBeenCalled();
  });
});
