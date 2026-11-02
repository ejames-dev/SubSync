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

  /**
   * Atomically claim pending notifications for delivery. Each record is
   * marked delivered with a conditional update (`deliveredAt: null`), so
   * when two pollers race — Electron plus a browser tab, or two tabs —
   * only the poller whose update wins receives the notification and all
   * others see it as already claimed. This replaces the racy
   * list-then-ack flow, where every poller could display the same item
   * before any acknowledgement landed.
   */
  async claimPending(
    channel: NotificationChannel = 'push',
    limit = 20,
  ): Promise<PendingRenewalNotification[]> {
    const candidates = await this.prisma.pendingNotification.findMany({
      where: {
        channel,
        deliveredAt: null,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    const claimed: PendingRenewalNotification[] = [];
    for (const candidate of candidates) {
      const result = await this.prisma.pendingNotification.updateMany({
        where: { id: candidate.id, deliveredAt: null },
        data: { deliveredAt: new Date() },
      });
      if (result.count === 1) {
        claimed.push(this.toDomain(candidate));
      }
    }

    return claimed;
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
    return this.queueNotification(input);
  }

  async queueNotification(input: {
    subscriptionId?: string;
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
    subscriptionId: string | null;
    channel: string;
    title: string;
    body: string;
    createdAt: Date;
  }): PendingRenewalNotification {
    return {
      id: record.id,
      subscriptionId: record.subscriptionId ?? undefined,
      channel: record.channel as NotificationChannel,
      title: record.title,
      body: record.body,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
