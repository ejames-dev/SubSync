import { Injectable } from '@nestjs/common';
import { UserSettings } from '@subscription-tracker/types';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const SETTINGS_ID = 'default';
const EMAIL_FORWARDING_ALIAS = 'subs+general@beacon.app';

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
      },
    });

    return this.toDomain(settings.leadTimeDays, settings.notificationChannels);
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<UserSettings> {
    const settings = await this.prisma.userSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {
        leadTimeDays: dto.leadTimeDays,
        notificationChannels: JSON.stringify(dto.channels),
      },
      create: {
        id: SETTINGS_ID,
        leadTimeDays: dto.leadTimeDays,
        notificationChannels: JSON.stringify(dto.channels),
      },
    });

    return this.toDomain(settings.leadTimeDays, settings.notificationChannels);
  }

  private toDomain(
    leadTimeDays: number,
    notificationChannels: string,
  ): UserSettings {
    let channels: UserSettings['notificationPreference']['channels'] = [
      'email',
      'push',
    ];

    try {
      const parsed = JSON.parse(notificationChannels);
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
        leadTimeDays,
        channels,
      },
      emailForwardingAlias: EMAIL_FORWARDING_ALIAS,
    };
  }
}
