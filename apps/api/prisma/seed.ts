import { PrismaClient } from './generated/client';
import { STREAMING_SERVICES } from '../src/service-catalog/service-catalog.data';

type SeedSubscription = {
  id: string;
  serviceId: string;
  planName: string;
  status: 'active' | 'trial' | 'canceled_pending';
  billingAmount: number;
  billingCurrency: string;
  billingInterval: 'monthly' | 'yearly' | 'quarterly' | 'custom';
  nextRenewal: Date;
  paymentSource?: 'card' | 'paypal' | 'gift' | 'other';
  paymentLast4?: string;
  notes?: string;
  statusChangedAt: Date;
  events: Array<{
    id: string;
    eventType: 'created' | 'status_changed' | 'renewal';
    status: 'active' | 'trial' | 'canceled_pending';
    occurredAt: Date;
    notes?: string;
  }>;
};

const SAMPLE_SUBSCRIPTIONS: SeedSubscription[] = [
  {
    id: 'sub_seed_spotify',
    serviceId: 'svc_spotify',
    planName: 'Premium Individual',
    status: 'active',
    billingAmount: 15,
    billingCurrency: 'USD',
    billingInterval: 'monthly',
    nextRenewal: new Date('2026-04-12T12:00:00Z'),
    paymentSource: 'card',
    paymentLast4: '4242',
    notes: 'Personal plan',
    statusChangedAt: new Date('2026-02-01T12:00:00Z'),
    events: [
      {
        id: 'evt_seed_spotify_created',
        eventType: 'created',
        status: 'active',
        occurredAt: new Date('2026-02-01T12:00:00Z'),
        notes: 'Manual entry',
      },
    ],
  },
  {
    id: 'sub_seed_netflix',
    serviceId: 'svc_netflix',
    planName: 'Standard',
    status: 'canceled_pending',
    billingAmount: 19.99,
    billingCurrency: 'USD',
    billingInterval: 'monthly',
    nextRenewal: new Date('2026-03-25T12:00:00Z'),
    paymentSource: 'card',
    paymentLast4: '1881',
    notes: 'Cancel after finale',
    statusChangedAt: new Date('2026-03-10T12:00:00Z'),
    events: [
      {
        id: 'evt_seed_netflix_created',
        eventType: 'created',
        status: 'active',
        occurredAt: new Date('2026-01-15T12:00:00Z'),
      },
      {
        id: 'evt_seed_netflix_canceled',
        eventType: 'status_changed',
        status: 'canceled_pending',
        occurredAt: new Date('2026-03-10T12:00:00Z'),
        notes: 'User scheduled cancellation',
      },
    ],
  },
  {
    id: 'sub_seed_disney',
    serviceId: 'svc_disney_plus',
    planName: 'Disney+ Duo Basic',
    status: 'trial',
    billingAmount: 0,
    billingCurrency: 'USD',
    billingInterval: 'monthly',
    nextRenewal: new Date('2026-03-30T12:00:00Z'),
    paymentSource: 'other',
    notes: 'Intro promo via bundle',
    statusChangedAt: new Date('2026-03-05T12:00:00Z'),
    events: [
      {
        id: 'evt_seed_disney_created',
        eventType: 'created',
        status: 'trial',
        occurredAt: new Date('2026-03-05T12:00:00Z'),
      },
    ],
  },
];

const prisma = new PrismaClient();

async function seedServices() {
  for (const service of STREAMING_SERVICES) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: {
        name: service.name,
        category: service.category,
        supportsOAuth: service.supportsOAuth,
        description: service.description,
      },
      create: {
        id: service.id,
        name: service.name,
        category: service.category,
        supportsOAuth: service.supportsOAuth,
        description: service.description,
      },
    });
  }
}

async function seedNotificationPreferences() {
  await prisma.notificationPreference.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      leadTimeDays: 7,
      channels: ['email'],
    },
  });
}

async function seedSubscriptions() {
  for (const sample of SAMPLE_SUBSCRIPTIONS) {
    const baseData = {
      planName: sample.planName,
      status: sample.status,
      billingAmount: sample.billingAmount,
      billingCurrency: sample.billingCurrency,
      billingInterval: sample.billingInterval,
      nextRenewal: sample.nextRenewal,
      paymentSource: sample.paymentSource,
      paymentLast4: sample.paymentLast4,
      notes: sample.notes,
      autoImportSource: 'manual',
      statusChangedAt: sample.statusChangedAt,
    } as const;

    await prisma.subscription.upsert({
      where: { id: sample.id },
      update: {
        ...baseData,
        serviceId: sample.serviceId,
      },
      create: {
        id: sample.id,
        serviceId: sample.serviceId,
        ...baseData,
      },
    });

    await prisma.subscriptionEvent.deleteMany({ where: { subscriptionId: sample.id } });
    if (sample.events.length > 0) {
      await prisma.subscriptionEvent.createMany({
        data: sample.events.map((event) => ({
          id: event.id,
          subscriptionId: sample.id,
          eventType: event.eventType,
          status: event.status,
          occurredAt: event.occurredAt,
          notes: event.notes,
        })),
        skipDuplicates: true,
      });
    }
  }
}

async function main() {
  await seedServices();
  await seedNotificationPreferences();
  await seedSubscriptions();
}

main()
  .catch((err) => {
    console.error('Seed failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
