import { ReminderService } from './reminder.service';

describe('ReminderService', () => {
  const prisma = {
    subscription: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const notificationPreferences = {
    getPreference: jest.fn(),
  };
  const notificationDelivery = {
    queueRenewalReminder: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    notificationPreferences.getPreference.mockResolvedValue({
      id: 'default',
      leadTimeDays: 7,
      channels: ['push'],
    });
    prisma.subscription.updateMany.mockResolvedValue({ count: 1 });
    notificationDelivery.queueRenewalReminder.mockResolvedValue({
      id: 'notif_1',
      subscriptionId: 'sub_1',
      channel: 'push',
      title: 'Netflix renews soon',
      body: 'Standard renews soon',
      createdAt: new Date().toISOString(),
    });
  });

  it('queues push notifications for due subscriptions', async () => {
    prisma.subscription.findMany.mockResolvedValue([
      {
        id: 'sub_1',
        planName: 'Standard',
        billingAmountCents: 1549,
        billingCurrency: 'USD',
        nextRenewal: new Date('2026-03-18T00:00:00.000Z'),
        service: { name: 'Netflix' },
      },
    ]);

    const service = new ReminderService(
      prisma as never,
      notificationPreferences as never,
      notificationDelivery as never,
    );

    await expect(service.queueDueRenewalReminders()).resolves.toBe(1);
    expect(notificationDelivery.queueRenewalReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: 'sub_1',
        channel: 'push',
        title: 'Netflix renews soon',
      }),
    );
    expect(prisma.subscription.updateMany).toHaveBeenCalled();
  });

  it('returns zero when no subscriptions are due', async () => {
    prisma.subscription.findMany.mockResolvedValue([]);
    const service = new ReminderService(
      prisma as never,
      notificationPreferences as never,
      notificationDelivery as never,
    );

    await expect(service.queueDueRenewalReminders()).resolves.toBe(0);
    expect(notificationDelivery.queueRenewalReminder).not.toHaveBeenCalled();
  });
});
