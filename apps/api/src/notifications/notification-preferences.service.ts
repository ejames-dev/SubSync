import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationPreference } from '@subscription-tracker/types';
import { UpdateNotificationPreferenceDto } from './dto/update-notification-preference.dto';

const DEFAULT_ID = 'default';

@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreference(): Promise<NotificationPreference> {
    const record = await this.prisma.notificationPreference.findUnique({
      where: { id: DEFAULT_ID },
    });

    if (!record) {
      const created = await this.prisma.notificationPreference.create({
        data: {
          id: DEFAULT_ID,
          channels: ['email'],
        },
      });
      return this.toDto(created);
    }

    return this.toDto(record);
  }

  async update(
    dto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreference> {
    const updated = await this.prisma.notificationPreference.upsert({
      where: { id: DEFAULT_ID },
      update: {
        leadTimeDays: dto.leadTimeDays,
        channels: dto.channels,
      },
      create: {
        id: DEFAULT_ID,
        leadTimeDays: dto.leadTimeDays,
        channels: dto.channels,
      },
    });

    return this.toDto(updated);
  }

  private toDto(record: {
    id: string;
    leadTimeDays: number;
    channels: unknown;
    updatedAt: Date;
  }): NotificationPreference {
    return {
      id: record.id,
      leadTimeDays: record.leadTimeDays,
      channels: (record.channels as Array<'email' | 'push'>) ?? ['email'],
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
