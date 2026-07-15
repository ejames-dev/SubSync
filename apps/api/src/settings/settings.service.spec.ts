import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  const prisma = {
    userSettings: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the selected forecast currency when no alert threshold is set', async () => {
    prisma.userSettings.upsert.mockResolvedValue({
      id: 'default',
      leadTimeDays: 7,
      notificationChannels: JSON.stringify(['push']),
      monthlyBudgetCents: null,
      budgetCurrency: 'CAD',
      budgetAlertTriggered: false,
    });
    const service = new SettingsService(prisma as never);

    await expect(service.getSettings()).resolves.toEqual(
      expect.objectContaining({
        budgetCurrency: 'CAD',
        monthlyBudget: undefined,
      }),
    );
  });

  it('preserves the alert latch when unrelated settings change', async () => {
    const existing = {
      id: 'default',
      leadTimeDays: 7,
      notificationChannels: JSON.stringify(['push']),
      monthlyBudgetCents: 5000,
      budgetCurrency: 'USD',
      budgetAlertTriggered: true,
    };
    prisma.userSettings.findUnique.mockResolvedValue(existing);
    prisma.userSettings.upsert.mockResolvedValue({
      ...existing,
      leadTimeDays: 14,
    });
    const service = new SettingsService(prisma as never);

    await service.updateSettings({ leadTimeDays: 14, channels: ['push'] });

    expect(prisma.userSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.not.objectContaining({ budgetAlertTriggered: false }),
      }),
    );
  });

  it('re-arms budget alerts when the threshold or currency changes', async () => {
    const existing = {
      id: 'default',
      leadTimeDays: 7,
      notificationChannels: JSON.stringify(['push']),
      monthlyBudgetCents: 5000,
      budgetCurrency: 'USD',
      budgetAlertTriggered: true,
    };
    prisma.userSettings.findUnique.mockResolvedValue(existing);
    prisma.userSettings.upsert.mockResolvedValue({
      ...existing,
      monthlyBudgetCents: 6000,
      budgetAlertTriggered: false,
    });
    const service = new SettingsService(prisma as never);

    await service.updateSettings({
      leadTimeDays: 7,
      channels: ['push'],
      monthlyBudgetCents: 6000,
      budgetCurrency: 'USD',
    });

    expect(prisma.userSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ budgetAlertTriggered: false }),
      }),
    );
  });
});
