import { Injectable } from '@nestjs/common';
import { UserSettings } from '@subscription-tracker/types';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const SETTINGS_ID = 'default';
const EMAIL_FORWARDING_ALIAS = 'subs+general@subsync.app';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<UserSettings> {
    const settings = await this.prisma.userSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: {
        id: SETTINGS_ID,
        leadTimeDays: 7,
        notificationChannels: JSON.stringify(['email', 'push']),
        monthlyBudgetCents: null,
        budgetCurrency: 'USD',
        budgetAlertTriggered: false,
      },
    });

    return this.toDomain(settings);
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<UserSettings> {
    const existing = await this.prisma.userSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    const monthlyBudgetCents =
      dto.monthlyBudgetCents === undefined
        ? (existing?.monthlyBudgetCents ?? null)
        : dto.monthlyBudgetCents;
    const budgetCurrency = (
      dto.budgetCurrency ??
      existing?.budgetCurrency ??
      'USD'
    ).toUpperCase();
    const budgetChanged =
      !existing ||
      existing.monthlyBudgetCents !== monthlyBudgetCents ||
      existing.budgetCurrency !== budgetCurrency;

    const settings = await this.prisma.userSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {
        leadTimeDays: dto.leadTimeDays,
        notificationChannels: JSON.stringify(dto.channels),
        monthlyBudgetCents,
        budgetCurrency,
        ...(budgetChanged ? { budgetAlertTriggered: false } : {}),
      },
      create: {
        id: SETTINGS_ID,
        leadTimeDays: dto.leadTimeDays,
        notificationChannels: JSON.stringify(dto.channels),
        monthlyBudgetCents,
        budgetCurrency,
        budgetAlertTriggered: false,
      },
    });

    return this.toDomain(settings);
  }

  private toDomain(settings: {
    leadTimeDays: number;
    notificationChannels: string;
    monthlyBudgetCents?: number | null;
    budgetCurrency?: string | null;
    budgetAlertTriggered?: boolean;
  }): UserSettings {
    const budgetCurrency = settings.budgetCurrency?.toUpperCase() ?? 'USD';
    const monthlyBudgetCents =
      typeof settings.monthlyBudgetCents === 'number'
        ? settings.monthlyBudgetCents
        : undefined;
    let channels: UserSettings['notificationPreference']['channels'] = [
      'email',
      'push',
    ];

    try {
      const parsed = JSON.parse(settings.notificationChannels);
      if (Array.isArray(parsed)) {
        channels = parsed.filter(
          (value): value is 'email' | 'push' =>
            value === 'email' || value === 'push',
        );
      }
    } catch {
      channels = ['email', 'push'];
    }

    return {
      notificationPreference: {
        id: SETTINGS_ID,
        leadTimeDays: settings.leadTimeDays,
        channels,
      },
      emailForwardingAlias: EMAIL_FORWARDING_ALIAS,
      budgetCurrency,
      monthlyBudget:
        monthlyBudgetCents === undefined
          ? undefined
          : {
              amount: monthlyBudgetCents / 100,
              currency: budgetCurrency,
              alertTriggered: settings.budgetAlertTriggered ?? false,
            },
    };
  }
}
