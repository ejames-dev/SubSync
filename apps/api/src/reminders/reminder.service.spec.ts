import { ReminderService } from './reminder.service';

describe('ReminderService', () => {
  const prisma = {
    subscription: {
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    subscriptionEvent: {
      create: jest.fn(),
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
    prisma.subscription.update.mockResolvedValue({});
    prisma.subscriptionEvent.create.mockResolvedValue({});
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
    expect(prisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          nextRenewalReminderSent: false,
          OR: [
            { snoozedUntil: null },
            { snoozedUntil: { lte: expect.any(Date) } },
          ],
        }),
      }),
    );
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

  it('rolls forward elapsed active renewals, converts trials, and archives canceled_pending', async () => {
    const now = new Date('2026-05-15T12:00:00.000Z');
    prisma.subscription.findMany.mockResolvedValue([
      {
        id: 'sub_active',
        status: 'active',
        planName: 'Premium',
        billingAmountCents: 1500,
        billingCurrency: 'USD',
        billingInterval: 'monthly',
        customIntervalDays: null,
        nextRenewal: new Date('2026-05-01T00:00:00.000Z'),
        trialEndsAt: null,
        postTrialAmountCents: null,
        service: { name: 'Spotify' },
      },
      {
        id: 'sub_canceling',
        status: 'canceled_pending',
        planName: 'Standard',
        billingAmountCents: 1999,
        billingCurrency: 'USD',
        billingInterval: 'monthly',
        customIntervalDays: null,
        nextRenewal: new Date('2026-05-10T00:00:00.000Z'),
        trialEndsAt: null,
        postTrialAmountCents: null,
        service: { name: 'Netflix' },
      },
      {
        id: 'sub_trial',
        status: 'trial',
        planName: 'Pro',
        billingAmountCents: 0,
        billingCurrency: 'USD',
        billingInterval: 'monthly',
        customIntervalDays: null,
        nextRenewal: new Date('2026-05-12T00:00:00.000Z'),
        trialEndsAt: new Date('2026-05-12T00:00:00.000Z'),
        postTrialAmountCents: 2000,
        service: { name: 'ChatGPT Plus' },
      },
    ]);

    const service = new ReminderService(
      prisma as never,
      notificationPreferences as never,
      notificationDelivery as never,
    );

    await expect(service.rolloverElapsedRenewals(now)).resolves.toBe(3);

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub_active' },
        data: expect.objectContaining({
          nextRenewal: new Date('2026-06-01T00:00:00.000Z'),
          nextRenewalReminderSent: false,
        }),
      }),
    );
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub_canceling' },
        data: expect.objectContaining({
          status: 'canceled',
        }),
      }),
    );
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub_trial' },
        data: expect.objectContaining({
          status: 'active',
          billingAmountCents: 2000,
          nextRenewal: new Date('2026-06-12T00:00:00.000Z'),
        }),
      }),
    );
  });

  it('honors per-subscription leadTimeDaysOverride and trial conversion copy', async () => {
    const now = new Date('2026-05-01T00:00:00.000Z');
    prisma.subscription.findMany.mockResolvedValue([
      {
        id: 'sub_override_due',
        status: 'trial',
        planName: 'Plus Trial',
        billingAmountCents: 0,
        billingCurrency: 'USD',
        nextRenewal: new Date('2026-05-12T00:00:00.000Z'),
        trialEndsAt: new Date('2026-05-12T00:00:00.000Z'),
        postTrialAmountCents: 2000,
        leadTimeDaysOverride: 14,
        service: { name: 'ChatGPT' },
      },
      {
        id: 'sub_not_due',
        status: 'active',
        planName: 'Basic',
        billingAmountCents: 999,
        billingCurrency: 'USD',
        nextRenewal: new Date('2026-05-12T00:00:00.000Z'),
        trialEndsAt: null,
        postTrialAmountCents: null,
        leadTimeDaysOverride: null,
        service: { name: 'Hulu' },
      },
    ]);

    const service = new ReminderService(
      prisma as never,
      notificationPreferences as never,
      notificationDelivery as never,
    );

    await expect(service.queueDueRenewalReminders(now)).resolves.toBe(1);
    expect(notificationDelivery.queueRenewalReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: 'sub_override_due',
        title: 'ChatGPT trial ends soon',
        body: expect.stringContaining('converts to USD 20.00'),
      }),
    );
  });
});
