import { Injectable, NotFoundException } from '@nestjs/common';
import { Subscription, SubscriptionEvent } from '@subscription-tracker/types';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  Subscription as PrismaSubscription,
  SubscriptionEvent as PrismaSubscriptionEvent,
  SubscriptionEventType as PrismaSubscriptionEventType,
  SubscriptionStatus as PrismaSubscriptionStatus,
} from '@prisma/client';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<Subscription[]> {
    const subs = await this.prisma.subscription.findMany({
      orderBy: { nextRenewal: 'asc' },
    });
    return subs.map((subscription) => this.toDomain(subscription));
  }

  async findOne(id: string): Promise<Subscription> {
    const sub = await this.getEntityOrThrow(id);
    return this.toDomain(sub);
  }

  async create(dto: CreateSubscriptionDto): Promise<Subscription> {
    const data = this.mapDtoToCreate(dto);
    const created = await this.prisma.subscription.create({ data });
    await this.recordEvent(created.id, 'created', created.status);
    return this.toDomain(created);
  }

  async update(id: string, dto: UpdateSubscriptionDto): Promise<Subscription> {
    const existing = await this.getEntityOrThrow(id);
    const statusChanged =
      dto.status !== undefined && dto.status !== existing.status;

    const updateData = this.mapDtoToUpdate(dto);
    if (statusChanged) {
      updateData.statusChangedAt = new Date();
    }

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: updateData,
    });

    if (statusChanged) {
      await this.recordEvent(updated.id, 'status_changed', updated.status);
    }

    return this.toDomain(updated);
  }

  async remove(id: string): Promise<void> {
    await this.getEntityOrThrow(id);
    await this.prisma.subscription.delete({ where: { id } });
  }

  async listEvents(subscriptionId: string): Promise<SubscriptionEvent[]> {
    await this.getEntityOrThrow(subscriptionId);
    const events = await this.prisma.subscriptionEvent.findMany({
      where: { subscriptionId },
      orderBy: { occurredAt: 'desc' },
    });
    return events.map((event) => this.toEventDomain(event));
  }

  async recentEvents(limit?: number): Promise<SubscriptionEvent[]> {
    const normalized =
      typeof limit === 'number' && !Number.isNaN(limit) ? limit : 5;
    const take = Math.min(Math.max(normalized, 1), 20);
    const events = await this.prisma.subscriptionEvent.findMany({
      orderBy: { occurredAt: 'desc' },
      take,
    });
    return events.map((event) => this.toEventDomain(event));
  }

  private async getEntityOrThrow(id: string): Promise<PrismaSubscription> {
    const found = await this.prisma.subscription.findUnique({ where: { id } });
    if (!found) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }
    return found;
  }

  private mapDtoToCreate(
    dto: CreateSubscriptionDto,
  ): Prisma.SubscriptionCreateInput {
    return {
      status: dto.status ?? 'active',
      autoImportSource: 'manual',
      service: { connect: { id: dto.serviceId } },
      planName: dto.planName,
      billingAmount: new Prisma.Decimal(dto.billingAmount),
      billingCurrency: dto.billingCurrency,
      billingInterval: dto.billingInterval,
      nextRenewal: new Date(dto.nextRenewal),
      paymentSource: dto.paymentSource,
      paymentLast4: dto.paymentLast4,
      notes: dto.notes,
      nextRenewalReminderSent: false,
    };
  }

  private mapDtoToUpdate(
    dto: UpdateSubscriptionDto,
  ): Prisma.SubscriptionUpdateInput {
    const data: Prisma.SubscriptionUpdateInput = {};
    if (dto.serviceId) {
      data.service = { connect: { id: dto.serviceId } };
    }
    if (dto.planName !== undefined) data.planName = dto.planName;
    if (dto.billingAmount !== undefined) {
      data.billingAmount = new Prisma.Decimal(dto.billingAmount);
    }
    if (dto.billingCurrency !== undefined)
      data.billingCurrency = dto.billingCurrency;
    if (dto.billingInterval !== undefined)
      data.billingInterval = dto.billingInterval;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.nextRenewal !== undefined) {
      data.nextRenewal = new Date(dto.nextRenewal);
      data.nextRenewalReminderSent = false;
    }
    if (dto.paymentSource !== undefined) data.paymentSource = dto.paymentSource;
    if (dto.paymentLast4 !== undefined) data.paymentLast4 = dto.paymentLast4;
    if (dto.notes !== undefined) data.notes = dto.notes;
    return data;
  }

  private async recordEvent(
    subscriptionId: string,
    eventType: PrismaSubscriptionEventType,
    status: PrismaSubscriptionStatus,
    notes?: string,
  ) {
    await this.prisma.subscriptionEvent.create({
      data: {
        subscriptionId,
        eventType,
        status,
        notes,
      },
    });
  }

  private toDomain(sub: PrismaSubscription): Subscription {
    return {
      id: sub.id,
      serviceId: sub.serviceId,
      planName: sub.planName,
      status: sub.status,
      billingAmount: Number(sub.billingAmount),
      billingCurrency: sub.billingCurrency,
      billingInterval: sub.billingInterval,
      nextRenewal: sub.nextRenewal.toISOString(),
      paymentSource: this.toPaymentSource(sub.paymentSource),
      paymentLast4: sub.paymentLast4 ?? undefined,
      autoImportSource: this.toAutoImportSource(sub.autoImportSource),
      notes: sub.notes ?? undefined,
      nextRenewalReminderSent: sub.nextRenewalReminderSent,
      statusChangedAt: sub.statusChangedAt.toISOString(),
    };
  }

  private toEventDomain(event: PrismaSubscriptionEvent): SubscriptionEvent {
    return {
      id: event.id,
      subscriptionId: event.subscriptionId,
      eventType: event.eventType,
      status: event.status,
      notes: event.notes ?? undefined,
      occurredAt: event.occurredAt.toISOString(),
    };
  }

  private toAutoImportSource(
    value: string | null,
  ): Subscription['autoImportSource'] | undefined {
    if (value === 'oauth' || value === 'email' || value === 'manual') {
      return value;
    }
    return undefined;
  }

  private toPaymentSource(
    value: string | null,
  ): Subscription['paymentSource'] | undefined {
    if (
      value === 'card' ||
      value === 'paypal' ||
      value === 'gift' ||
      value === 'other'
    ) {
      return value;
    }
    return undefined;
  }
}
