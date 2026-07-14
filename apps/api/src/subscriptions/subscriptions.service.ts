import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationChannel,
  Subscription,
  SubscriptionEvent,
} from '@subscription-tracker/types';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  Subscription as PrismaSubscription,
  SubscriptionEvent as PrismaSubscriptionEvent,
} from '../../prisma/generated/client';
import { ServiceCatalogService } from '../service-catalog/service-catalog.service';

type ImportedSubscriptionInput = {
  serviceId: string;
  planName: string;
  billingAmount: number;
  billingCurrency: string;
  billingInterval: Subscription['billingInterval'];
  nextRenewal: string;
  paymentSource?: Subscription['paymentSource'];
  paymentLast4?: string;
  notes?: string;
  autoImportSource: NonNullable<Subscription['autoImportSource']>;
  importKey?: string;
  observedAt?: string;
  priceChangeNotification?: {
    channels: NotificationChannel[];
    title: string;
  };
};

type ImportedSubscriptionResult = {
  mode: 'created' | 'updated' | 'ignored';
  subscription: Subscription;
  priceChange?: {
    previousAmount: number;
    previousCurrency: string;
    newAmount: number;
    newCurrency: string;
  };
};

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceCatalog: ServiceCatalogService,
  ) {}

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
    await this.assertServiceExists(dto.serviceId);
    const data = this.mapDtoToCreate(dto);
    const created = await this.prisma.subscription.create({ data });
    await this.recordEvent(
      created.id,
      'created',
      this.toStatus(created.status),
    );
    return this.toDomain(created);
  }

  async update(id: string, dto: UpdateSubscriptionDto): Promise<Subscription> {
    const existing = await this.getEntityOrThrow(id);
    if (dto.serviceId !== undefined) {
      await this.assertServiceExists(dto.serviceId);
    }

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
      await this.recordEvent(
        updated.id,
        'status_changed',
        this.toStatus(updated.status),
      );
    }

    return this.toDomain(updated);
  }

  async remove(id: string): Promise<void> {
    await this.getEntityOrThrow(id);
    await this.prisma.subscription.delete({ where: { id } });
  }

  async snoozeRenewal(id: string, days = 7): Promise<Subscription> {
    await this.getEntityOrThrow(id);
    const snoozedUntil = new Date();
    snoozedUntil.setDate(snoozedUntil.getDate() + days);

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: { snoozedUntil },
    });

    await this.recordEvent(
      id,
      'renewal',
      this.toStatus(updated.status),
      `Renewal snoozed until ${snoozedUntil.toISOString()}`,
    );

    return this.toDomain(updated);
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

  async upsertImported(
    input: ImportedSubscriptionInput,
  ): Promise<ImportedSubscriptionResult> {
    await this.assertServiceExists(input.serviceId);
    return this.prisma.$transaction((client) =>
      this.upsertImportedInTransaction(input, client),
    );
  }

  private async upsertImportedInTransaction(
    input: ImportedSubscriptionInput,
    db: Prisma.TransactionClient,
  ): Promise<ImportedSubscriptionResult> {
    const byImportKey = input.importKey
      ? await db.subscription.findUnique({
          where: { importKey: input.importKey },
        })
      : null;
    const existing =
      byImportKey ??
      (await db.subscription.findFirst({
        where: input.paymentLast4
          ? {
              serviceId: input.serviceId,
              OR: [
                { planName: input.planName },
                { paymentLast4: input.paymentLast4 },
              ],
            }
          : { serviceId: input.serviceId, planName: input.planName },
        orderBy: { updatedAt: 'desc' },
      }));

    if (existing) {
      const observedAt = input.observedAt
        ? new Date(input.observedAt)
        : new Date();
      if (
        existing.lastImportedAt &&
        observedAt.getTime() < existing.lastImportedAt.getTime()
      ) {
        return { mode: 'ignored', subscription: this.toDomain(existing) };
      }

      const newAmountCents = this.toAmountCents(input.billingAmount);
      const priceChanged =
        existing.billingAmountCents !== newAmountCents ||
        existing.billingCurrency !== input.billingCurrency;
      const updated = await db.subscription.update({
        where: { id: existing.id },
        data: {
          billingAmountCents: newAmountCents,
          billingCurrency: input.billingCurrency,
          billingInterval: input.billingInterval,
          nextRenewal: new Date(input.nextRenewal),
          paymentSource: input.paymentSource,
          paymentLast4: input.paymentLast4,
          notes: input.notes,
          autoImportSource: input.autoImportSource,
          status: 'active',
          nextRenewalReminderSent: false,
          importKey: input.importKey ?? existing.importKey,
          lastImportedAt: observedAt,
        },
      });

      if (priceChanged) {
        await this.recordEvent(
          updated.id,
          'price_changed',
          this.toStatus(updated.status),
          `Price changed from ${existing.billingCurrency} ${this.fromAmountCents(existing.billingAmountCents).toFixed(2)} to ${updated.billingCurrency} ${this.fromAmountCents(updated.billingAmountCents).toFixed(2)} via email import`,
          db,
        );
        for (const channel of input.priceChangeNotification?.channels ?? []) {
          await db.pendingNotification.create({
            data: {
              subscriptionId: updated.id,
              channel,
              title: input.priceChangeNotification?.title ?? 'Price changed',
              body: `${input.planName} changed from ${existing.billingCurrency} ${this.fromAmountCents(existing.billingAmountCents).toFixed(2)} to ${updated.billingCurrency} ${this.fromAmountCents(updated.billingAmountCents).toFixed(2)}.`,
            },
          });
        }
      }

      return {
        mode: 'updated',
        subscription: this.toDomain(updated),
        priceChange: priceChanged
          ? {
              previousAmount: this.fromAmountCents(existing.billingAmountCents),
              previousCurrency: existing.billingCurrency,
              newAmount: this.fromAmountCents(updated.billingAmountCents),
              newCurrency: updated.billingCurrency,
            }
          : undefined,
      };
    }

    const created = await db.subscription.create({
      data: {
        status: 'active',
        autoImportSource: input.autoImportSource,
        service: { connect: { id: input.serviceId } },
        planName: input.planName,
        billingAmountCents: this.toAmountCents(input.billingAmount),
        billingCurrency: input.billingCurrency,
        billingInterval: input.billingInterval,
        nextRenewal: new Date(input.nextRenewal),
        paymentSource: input.paymentSource,
        paymentLast4: input.paymentLast4,
        notes: input.notes,
        nextRenewalReminderSent: false,
        importKey: input.importKey,
        lastImportedAt: input.observedAt
          ? new Date(input.observedAt)
          : new Date(),
      },
    });
    await this.recordEvent(
      created.id,
      'created',
      this.toStatus(created.status),
      'Imported from email',
      db,
    );
    return { mode: 'created', subscription: this.toDomain(created) };
  }

  private async getEntityOrThrow(id: string): Promise<PrismaSubscription> {
    const found = await this.prisma.subscription.findUnique({ where: { id } });
    if (!found) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }
    return found;
  }

  private async assertServiceExists(serviceId: string) {
    const found = await this.serviceCatalog.ensureExists(serviceId);
    if (!found) {
      throw new NotFoundException(`Service ${serviceId} not found`);
    }
  }

  private mapDtoToCreate(
    dto: CreateSubscriptionDto,
  ): Prisma.SubscriptionCreateInput {
    return {
      status: dto.status ?? 'active',
      autoImportSource: 'manual',
      service: { connect: { id: dto.serviceId } },
      planName: dto.planName,
      billingAmountCents: this.toAmountCents(dto.billingAmount),
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
      data.billingAmountCents = this.toAmountCents(dto.billingAmount);
    }
    if (dto.billingCurrency !== undefined) {
      data.billingCurrency = dto.billingCurrency;
    }
    if (dto.billingInterval !== undefined) {
      data.billingInterval = dto.billingInterval;
    }
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
    eventType: SubscriptionEvent['eventType'],
    status: Subscription['status'],
    notes?: string,
    client: Pick<Prisma.TransactionClient, 'subscriptionEvent'> = this.prisma,
  ) {
    await client.subscriptionEvent.create({
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
      status: this.toStatus(sub.status),
      billingAmount: this.fromAmountCents(sub.billingAmountCents),
      billingCurrency: sub.billingCurrency,
      billingInterval: this.toBillingInterval(sub.billingInterval),
      nextRenewal: sub.nextRenewal.toISOString(),
      paymentSource: this.toPaymentSource(sub.paymentSource),
      paymentLast4: sub.paymentLast4 ?? undefined,
      autoImportSource: this.toAutoImportSource(sub.autoImportSource),
      notes: sub.notes ?? undefined,
      nextRenewalReminderSent: sub.nextRenewalReminderSent,
      snoozedUntil: sub.snoozedUntil?.toISOString(),
      statusChangedAt: sub.statusChangedAt.toISOString(),
    };
  }

  private toEventDomain(event: PrismaSubscriptionEvent): SubscriptionEvent {
    return {
      id: event.id,
      subscriptionId: event.subscriptionId,
      eventType: this.toEventType(event.eventType),
      status: this.toStatus(event.status),
      notes: event.notes ?? undefined,
      occurredAt: event.occurredAt.toISOString(),
    };
  }

  private toStatus(value: string): Subscription['status'] {
    if (value === 'trial' || value === 'canceled_pending') {
      return value;
    }
    return 'active';
  }

  private toBillingInterval(value: string): Subscription['billingInterval'] {
    if (
      value === 'yearly' ||
      value === 'quarterly' ||
      value === 'custom' ||
      value === 'monthly'
    ) {
      return value;
    }
    return 'monthly';
  }

  private toEventType(value: string): SubscriptionEvent['eventType'] {
    if (
      value === 'status_changed' ||
      value === 'renewal' ||
      value === 'price_changed'
    ) {
      return value;
    }
    return 'created';
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

  private toAmountCents(amount: number): number {
    return Math.round(amount * 100);
  }

  private fromAmountCents(amountCents: number): number {
    return amountCents / 100;
  }
}
