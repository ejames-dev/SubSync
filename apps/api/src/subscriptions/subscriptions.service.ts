import { Injectable, NotFoundException } from '@nestjs/common';
import { Subscription } from '@subscription-tracker/types';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  Subscription as PrismaSubscription,
} from '../../prisma/generated/client';

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
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }
    return this.toDomain(sub);
  }

  async create(dto: CreateSubscriptionDto): Promise<Subscription> {
    const data = this.mapDtoToCreate(dto);
    const created = await this.prisma.subscription.create({ data });
    return this.toDomain(created);
  }

  async update(id: string, dto: UpdateSubscriptionDto): Promise<Subscription> {
    await this.ensureExists(id);
    const updated = await this.prisma.subscription.update({
      where: { id },
      data: this.mapDtoToUpdate(dto),
    });
    return this.toDomain(updated);
  }

  async remove(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.subscription.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.subscription.findUnique({ where: { id } });
    if (!found) {
      throw new NotFoundException(`Subscription ${id} not found`);
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
      billingAmount: new Prisma.Decimal(dto.billingAmount),
      billingCurrency: dto.billingCurrency,
      billingInterval: dto.billingInterval,
      nextRenewal: new Date(dto.nextRenewal),
      paymentSource: dto.paymentSource,
      paymentLast4: dto.paymentLast4,
      notes: dto.notes,
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
    if (dto.nextRenewal !== undefined)
      data.nextRenewal = new Date(dto.nextRenewal);
    if (dto.paymentSource !== undefined) data.paymentSource = dto.paymentSource;
    if (dto.paymentLast4 !== undefined) data.paymentLast4 = dto.paymentLast4;
    if (dto.notes !== undefined) data.notes = dto.notes;
    return data;
  }

  private toDomain(sub: PrismaSubscription): Subscription {
    return {
      id: sub.id,
      serviceId: sub.serviceId,
      planName: sub.planName,
      status: this.toStatus(sub.status),
      billingAmount: Number(sub.billingAmount),
      billingCurrency: sub.billingCurrency,
      billingInterval: this.toBillingInterval(sub.billingInterval),
      nextRenewal: sub.nextRenewal.toISOString(),
      paymentSource: this.toPaymentSource(sub.paymentSource),
      paymentLast4: sub.paymentLast4 ?? undefined,
      autoImportSource: this.toAutoImportSource(sub.autoImportSource),
      notes: sub.notes ?? undefined,
    };
  }

  private toStatus(value: string): Subscription['status'] {
    if (value === 'trial' || value === 'canceled_pending') {
      return value;
    }
    return 'active';
  }

  private toBillingInterval(value: string): Subscription['billingInterval'] {
    const allowed: Subscription['billingInterval'][] = [
      'monthly',
      'yearly',
      'quarterly',
      'custom',
    ];
    return allowed.includes(value as Subscription['billingInterval'])
      ? (value as Subscription['billingInterval'])
      : 'monthly';
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
