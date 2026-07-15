import { ReminderService } from './reminder.service';

describe('ReminderService', () => {
  const prisma = {
    subscription: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    userSettings: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const notificationPreferences = {
    getPreference: jest.fn(),
  };
  const notificationDelivery = {
    queueRenewalReminder: jest.fn(),
    queueNotification: jest.fn(),
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
    notificationDelivery.queueNotification.mockResolvedValue({
      id: 'notif_budget',
      channel: 'push',
      title: 'Monthly budget reached',
      body: 'Budget reached',
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

  it('queues a deduplicated budget alert using only the selected currency', async () => {
    prisma.userSettings.findUnique.mockResolvedValue({
      id: 'default',
      monthlyBudgetCents: 2000,
      budgetCurrency: 'USD',
      budgetAlertTriggered: false,
      notificationChannels: JSON.stringify(['push']),
    });
    prisma.userSettings.updateMany.mockResolvedValue({ count: 1 });
    prisma.subscription.findMany.mockResolvedValue([
      {
        billingAmountCents: 1500,
        billingCurrency: 'USD',
        billingInterval: 'monthly',
      },
      {
        billingAmountCents: 1800,
        billingCurrency: 'usd',
        billingInterval: 'quarterly',
      },
      {
        billingAmountCents: 10000,
        billingCurrency: 'CAD',
        billingInterval: 'monthly',
      },
    ]);
    const service = new ReminderService(
      prisma as never,
      notificationPreferences as never,
      notificationDelivery as never,
    );

    await expect(service.queueBudgetAlert()).resolves.toBe(1);
    expect(prisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: ['active', 'trial', 'flagged_for_cancellation'],
          },
        }),
      }),
    );
    expect(prisma.userSettings.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ budgetAlertTriggered: false }),
        data: { budgetAlertTriggered: true },
      }),
    );
    expect(notificationDelivery.queueNotification).toHaveBeenCalledWith({
      channel: 'push',
      title: 'Monthly budget reached',
      body: expect.stringContaining('$21.00'),
    });
  });

  it('does not queue another budget alert after the threshold is claimed', async () => {
    prisma.userSettings.findUnique.mockResolvedValue({
      id: 'default',
      monthlyBudgetCents: 2000,
      budgetCurrency: 'USD',
      budgetAlertTriggered: true,
      notificationChannels: JSON.stringify(['push']),
    });
    prisma.userSettings.updateMany.mockResolvedValue({ count: 0 });
    prisma.subscription.findMany.mockResolvedValue([
      {
        billingAmountCents: 2500,
        billingCurrency: 'USD',
        billingInterval: 'monthly',
      },
    ]);
    const service = new ReminderService(
      prisma as never,
      notificationPreferences as never,
      notificationDelivery as never,
    );

    await expect(service.queueBudgetAlert()).resolves.toBe(0);
    expect(notificationDelivery.queueNotification).not.toHaveBeenCalled();
  });

  it('resets the alert latch after spend falls below budget', async () => {
    prisma.userSettings.findUnique.mockResolvedValue({
      id: 'default',
      monthlyBudgetCents: 2000,
      budgetCurrency: 'USD',
      budgetAlertTriggered: true,
      notificationChannels: JSON.stringify(['push']),
    });
    prisma.userSettings.updateMany.mockResolvedValue({ count: 1 });
    prisma.subscription.findMany.mockResolvedValue([
      {
        billingAmountCents: 1500,
        billingCurrency: 'USD',
        billingInterval: 'monthly',
      },
    ]);
    const service = new ReminderService(
      prisma as never,
      notificationPreferences as never,
      notificationDelivery as never,
    );

    await expect(service.queueBudgetAlert()).resolves.toBe(0);
    expect(prisma.userSettings.updateMany).toHaveBeenCalledWith({
      where: { id: 'default', budgetAlertTriggered: true },
      data: { budgetAlertTriggered: false },
    });
  });
});
