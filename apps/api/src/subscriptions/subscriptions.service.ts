import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { Subscription } from '@subscription-tracker/types';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Injectable()
export class SubscriptionsService {
  private readonly subscriptions = new Map<string, Subscription>();

  constructor() {
    const seed: Subscription = {
      id: 'seed-netflix',
      serviceId: 'svc_netflix',
      planName: 'Standard',
      status: 'active',
      billingAmount: 15.49,
      billingCurrency: 'USD',
      billingInterval: 'monthly',
      nextRenewal: new Date().toISOString(),
      paymentSource: 'card',
      paymentLast4: '4242',
      autoImportSource: 'email',
    };
    this.subscriptions.set(seed.id, seed);
  }

  list(): Subscription[] {
    return Array.from(this.subscriptions.values());
  }

  findOne(id: string): Subscription {
    const sub = this.subscriptions.get(id);
    if (!sub) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }
    return sub;
  }

  create(dto: CreateSubscriptionDto): Subscription {
    const entity: Subscription = {
      id: uuid(),
      status: 'active',
      autoImportSource: 'manual',
      ...dto,
    };
    this.subscriptions.set(entity.id, entity);
    return entity;
  }

  update(id: string, dto: UpdateSubscriptionDto): Subscription {
    const existing = this.findOne(id);
    const updated: Subscription = { ...existing, ...dto };
    this.subscriptions.set(id, updated);
    return updated;
  }

  remove(id: string): void {
    if (!this.subscriptions.delete(id)) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }
  }
}
