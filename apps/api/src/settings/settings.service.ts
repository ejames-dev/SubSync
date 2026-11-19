import { Injectable, Optional } from '@nestjs/common';
import { UserSettings } from '@subscription-tracker/types';
import { TokenCryptoService } from '../gmail/token-crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const SETTINGS_ID = 'default';
const EMAIL_FORWARDING_ALIAS = 'subs+general@subsync.app';

@Injectable()
export class SettingsService {
  private readonly tokenCrypto: TokenCryptoService;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() tokenCrypto?: TokenCryptoService,
  ) {
    this.tokenCrypto = tokenCrypto ?? new TokenCryptoService();
  }

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

    const smtpPasswordEnc =
      dto.smtpPassword === undefined
        ? (existing?.smtpPasswordEnc ?? null)
        : dto.smtpPassword === null || dto.smtpPassword.trim() === ''
          ? null
          : this.tokenCrypto.encrypt(dto.smtpPassword);

    const extraUpdate = {
      ...(dto.webhookUrl !== undefined
        ? { webhookUrl: dto.webhookUrl?.trim() || null }
        : {}),
      ...(dto.smtpHost !== undefined
        ? { smtpHost: dto.smtpHost?.trim() || null }
        : {}),
      ...(dto.smtpPort !== undefined ? { smtpPort: dto.smtpPort ?? null } : {}),
      ...(dto.smtpUsername !== undefined
        ? { smtpUsername: dto.smtpUsername?.trim() || null }
        : {}),
      ...(dto.smtpPassword !== undefined ? { smtpPasswordEnc } : {}),
      ...(dto.smtpFrom !== undefined
        ? { smtpFrom: dto.smtpFrom?.trim() || null }
        : {}),
      ...(dto.smtpTo !== undefined
        ? { smtpTo: dto.smtpTo?.trim() || null }
        : {}),
      ...(dto.syncFolderPath !== undefined
        ? { syncFolderPath: dto.syncFolderPath?.trim() || null }
        : {}),
    };

    const settings = await this.prisma.userSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {
        leadTimeDays: dto.leadTimeDays,
        notificationChannels: JSON.stringify(dto.channels),
        monthlyBudgetCents,
        budgetCurrency,
        ...(budgetChanged ? { budgetAlertTriggered: false } : {}),
        ...extraUpdate,
      },
      create: {
        id: SETTINGS_ID,
        leadTimeDays: dto.leadTimeDays,
        notificationChannels: JSON.stringify(dto.channels),
        monthlyBudgetCents,
        budgetCurrency,
        budgetAlertTriggered: false,
        ...extraUpdate,
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
    webhookUrl?: string | null;
    smtpHost?: string | null;
    smtpPort?: number | null;
    smtpUsername?: string | null;
    smtpPasswordEnc?: string | null;
    smtpFrom?: string | null;
    smtpTo?: string | null;
    syncFolderPath?: string | null;
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

    const hasSmtpFields = Boolean(
      settings.smtpHost ||
      settings.smtpPort ||
      settings.smtpUsername ||
      settings.smtpPasswordEnc ||
      settings.smtpFrom ||
      settings.smtpTo,
    );

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
      ...(settings.webhookUrl ? { webhookUrl: settings.webhookUrl } : {}),
      ...(hasSmtpFields
        ? {
            smtp: {
              host: settings.smtpHost ?? undefined,
              port: settings.smtpPort ?? undefined,
              username: settings.smtpUsername ?? undefined,
              hasPassword: Boolean(settings.smtpPasswordEnc),
              from: settings.smtpFrom ?? undefined,
              to: settings.smtpTo ?? undefined,
            },
          }
        : {}),
      ...(settings.syncFolderPath
        ? { syncFolderPath: settings.syncFolderPath }
        : {}),
    };
  }
}
