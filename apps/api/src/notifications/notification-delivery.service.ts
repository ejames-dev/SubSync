import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationChannel,
  PendingRenewalNotification,
} from '@subscription-tracker/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationDeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  async listPending(
    channel: NotificationChannel = 'push',
  ): Promise<PendingRenewalNotification[]> {
    const records = await this.prisma.pendingNotification.findMany({
      where: {
        channel,
        deliveredAt: null,
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    return records.map((record) => this.toDomain(record));
  }

  async acknowledge(id: string): Promise<PendingRenewalNotification> {
    const existing = await this.prisma.pendingNotification.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    const updated = await this.prisma.pendingNotification.update({
      where: { id },
      data: { deliveredAt: new Date() },
    });

    return this.toDomain(updated);
  }

  async queueRenewalReminder(input: {
    subscriptionId: string;
    channel: NotificationChannel;
    title: string;
    body: string;
  }): Promise<PendingRenewalNotification> {
    const created = await this.prisma.pendingNotification.create({
      data: input,
    });

    return this.toDomain(created);
  }

  private toDomain(record: {
    id: string;
    subscriptionId: string;
    channel: string;
    title: string;
    body: string;
    createdAt: Date;
  }): PendingRenewalNotification {
    return {
      id: record.id,
      subscriptionId: record.subscriptionId,
      channel: record.channel as NotificationChannel,
      title: record.title,
      body: record.body,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
