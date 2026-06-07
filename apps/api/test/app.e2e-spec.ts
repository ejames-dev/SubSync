import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('App (e2e)', () => {
  let app: INestApplication;
  const prismaMock = {
    service: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    integrationConnection: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    userSettings: {
      upsert: jest.fn(),
    },
    notificationPreference: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    subscription: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    pendingNotification: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    subscriptionEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    gmailConnection: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    oAuthState: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    processedGmailMessage: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    prismaMock.service.findMany.mockResolvedValue([]);
    prismaMock.service.findUnique.mockResolvedValue(null);
    prismaMock.service.upsert.mockImplementation(({ create }) =>
      Promise.resolve({
        ...create,
        description: create.description ?? null,
      }),
    );
    prismaMock.integrationConnection.findMany.mockResolvedValue([]);
    prismaMock.integrationConnection.upsert.mockImplementation(
      ({ create, update }) =>
        Promise.resolve({
          providerId: create.providerId,
          status: update?.status ?? create.status,
          source: update?.source ?? create.source,
          connectedAt: update?.connectedAt ?? create.connectedAt,
          lastSyncedAt: update?.lastSyncedAt ?? create.lastSyncedAt ?? null,
          updatedAt: new Date('2026-03-17T00:00:00.000Z'),
        }),
    );
    prismaMock.userSettings.upsert.mockImplementation(({ create, update }) =>
      Promise.resolve({
        id: 'default',
        leadTimeDays: update?.leadTimeDays ?? create.leadTimeDays,
        notificationChannels:
          update?.notificationChannels ?? create.notificationChannels,
      }),
    );
    prismaMock.notificationPreference.findUnique.mockResolvedValue(null);
    prismaMock.notificationPreference.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: data.id,
        leadTimeDays: 7,
        channels: data.channels,
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
        updatedAt: new Date('2026-03-17T00:00:00.000Z'),
      }),
    );
    prismaMock.notificationPreference.upsert.mockImplementation(
      ({ create, update }) =>
        Promise.resolve({
          id: 'default',
          leadTimeDays: update?.leadTimeDays ?? create.leadTimeDays,
          channels: update?.channels ?? create.channels,
          createdAt: new Date('2026-03-17T00:00:00.000Z'),
          updatedAt: new Date('2026-03-17T00:00:00.000Z'),
        }),
    );
    prismaMock.subscription.findMany.mockResolvedValue([
      {
        id: 'sub_netflix',
        serviceId: 'svc_netflix',
        planName: 'Standard',
        status: 'active',
        billingAmountCents: 1549,
        billingCurrency: 'USD',
        billingInterval: 'monthly',
        nextRenewal: new Date('2026-03-18T00:00:00.000Z'),
        paymentSource: 'card',
        paymentLast4: '4242',
        autoImportSource: 'manual',
        notes: null,
        nextRenewalReminderSent: false,
        statusChangedAt: new Date('2026-03-17T00:00:00.000Z'),
      },
    ]);
    prismaMock.subscription.findFirst.mockResolvedValue(null);
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.subscription.create.mockResolvedValue({
      id: 'sub_netflix',
      serviceId: 'svc_netflix',
      planName: 'Standard',
      status: 'active',
      billingAmountCents: 1549,
      billingCurrency: 'USD',
      billingInterval: 'monthly',
      nextRenewal: new Date('2026-03-18T00:00:00.000Z'),
      paymentSource: 'card',
      paymentLast4: '4242',
      autoImportSource: 'manual',
      notes: null,
      nextRenewalReminderSent: false,
      statusChangedAt: new Date('2026-03-17T00:00:00.000Z'),
    });
    prismaMock.subscription.update.mockResolvedValue({
      id: 'sub_netflix',
      serviceId: 'svc_netflix',
      planName: 'Standard',
      status: 'active',
      billingAmountCents: 1549,
      billingCurrency: 'USD',
      billingInterval: 'monthly',
      nextRenewal: new Date('2026-03-18T00:00:00.000Z'),
      paymentSource: 'card',
      paymentLast4: '4242',
      autoImportSource: 'email',
      notes: null,
      nextRenewalReminderSent: false,
      statusChangedAt: new Date('2026-03-17T00:00:00.000Z'),
    });
    prismaMock.subscriptionEvent.create.mockResolvedValue({
      id: 'evt_sub_netflix_created',
      subscriptionId: 'sub_netflix',
      eventType: 'created',
      status: 'active',
      notes: null,
      occurredAt: new Date('2026-03-17T00:00:00.000Z'),
      createdAt: new Date('2026-03-17T00:00:00.000Z'),
    });
    prismaMock.subscriptionEvent.findMany.mockResolvedValue([]);
    prismaMock.subscription.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.pendingNotification.findMany.mockResolvedValue([]);
    prismaMock.pendingNotification.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'notif_1',
        subscriptionId: data.subscriptionId,
        channel: data.channel,
        title: data.title,
        body: data.body,
        deliveredAt: null,
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
      }),
    );
    prismaMock.pendingNotification.findUnique.mockResolvedValue({
      id: 'notif_1',
      subscriptionId: 'sub_netflix',
      channel: 'push',
      title: 'Netflix renews soon',
      body: 'Standard renews soon',
      deliveredAt: null,
      createdAt: new Date('2026-03-17T00:00:00.000Z'),
    });
    prismaMock.pendingNotification.update.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'notif_1',
        subscriptionId: 'sub_netflix',
        channel: 'push',
        title: 'Netflix renews soon',
        body: 'Standard renews soon',
        deliveredAt: data.deliveredAt,
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
      }),
    );
    prismaMock.gmailConnection.findUnique.mockResolvedValue(null);
    prismaMock.oAuthState.create.mockImplementation(({ data }) =>
      Promise.resolve({
        state: data.state,
        provider: data.provider,
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
        expiresAt: data.expiresAt,
      }),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    jest.clearAllMocks();
  });

  it('/api/services (GET) returns the seeded fallback catalog', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/services')
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'svc_spotify',
          name: 'Spotify',
        }),
      ]),
    );
    expect(prismaMock.service.upsert).toHaveBeenCalled();
  });

  it('/api/subscriptions (POST) creates subscriptions for fallback services', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/subscriptions')
      .send({
        serviceId: 'svc_netflix',
        planName: 'Standard',
        billingAmount: 15.49,
        billingCurrency: 'USD',
        billingInterval: 'monthly',
        nextRenewal: '2026-03-18T00:00:00.000Z',
        paymentSource: 'card',
        paymentLast4: '4242',
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: 'sub_netflix',
        serviceId: 'svc_netflix',
        billingAmount: 15.49,
        autoImportSource: 'manual',
      }),
    );
    expect(prismaMock.service.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'svc_netflix' },
      }),
    );
    expect(prismaMock.subscription.create).toHaveBeenCalled();
  });

  it('/api/ingest/email (POST) rejects invalid payloads', () => {
    return request(app.getHttpServer())
      .post('/api/ingest/email')
      .send({
        sender: '',
        subject: '',
        receivedAt: 'not-a-date',
      })
      .expect(400);
  });

  it('/api/ingest/email (POST) creates a subscription from billing email content', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/ingest/email')
      .send({
        sender: 'billing@netflix.com',
        subject: 'Netflix Standard plan renews Apr 16, 2026',
        receivedAt: '2026-03-17T12:00:00.000Z',
        body: 'Amount: $15.49 billed monthly to card ending in 4242',
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'created',
        inferredProvider: 'Netflix',
        message: 'Created Netflix from email import.',
      }),
    );
    expect(prismaMock.subscription.create).toHaveBeenCalled();
    expect(prismaMock.integrationConnection.upsert).toHaveBeenCalled();
  });

  it('/api/integrations (GET/POST) persists connection state', async () => {
    const initial = await request(app.getHttpServer())
      .get('/api/integrations')
      .expect(200);

    expect(initial.body).toEqual([]);

    const connected = await request(app.getHttpServer())
      .post('/api/integrations/svc_spotify/connect')
      .send({
        source: 'oauth',
      })
      .expect(201);

    expect(connected.body).toEqual({
      connection: {
        providerId: 'svc_spotify',
        status: 'connected',
        source: 'oauth',
        connectedAt: expect.any(String),
        lastSyncedAt: expect.any(String),
      },
      message: 'Connected svc_spotify through the local desktop app.',
    });
  });

  it('/api/dashboard/summary (GET) returns computed metrics', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/summary')
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        monthlyEquivalentSpend: 15.49,
        activeSubscriptions: 1,
        upcomingRenewalCount: expect.any(Number),
        sourceBreakdown: {
          manual: 1,
          email: 0,
          oauth: 0,
        },
      }),
    );
  });

  it('/api/gmail/status (GET) reports disconnected when Gmail is not linked', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/gmail/status')
      .expect(200);

    expect(response.body).toEqual({
      connected: false,
      configured: false,
    });
  });

  it('/api/gmail/auth-url (GET) requires OAuth configuration', async () => {
    await request(app.getHttpServer()).get('/api/gmail/auth-url').expect(503);
  });

  it('/api/notifications/pending (GET) returns undelivered push notifications', async () => {
    prismaMock.pendingNotification.findMany.mockResolvedValueOnce([
      {
        id: 'notif_1',
        subscriptionId: 'sub_netflix',
        channel: 'push',
        title: 'Netflix renews soon',
        body: 'Standard renews on Mar 18, 2026 for USD 15.49.',
        deliveredAt: null,
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/api/notifications/pending')
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        id: 'notif_1',
        channel: 'push',
        title: 'Netflix renews soon',
      }),
    ]);
  });

  it('/api/notifications/:id/ack (POST) marks a notification as delivered', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/notifications/notif_1/ack')
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: 'notif_1',
        channel: 'push',
      }),
    );
    expect(prismaMock.pendingNotification.update).toHaveBeenCalled();
  });

  it('/api/notifications/preferences (GET) reads unified user settings', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/notifications/preferences')
      .expect(200);

    expect(response.body).toEqual({
      id: 'default',
      leadTimeDays: 7,
      channels: ['email', 'push'],
    });
  });

  it('/api/data/export/subscriptions (GET) exports JSON subscriptions', async () => {
    prismaMock.subscription.findMany.mockResolvedValueOnce([
      {
        id: 'sub_netflix',
        serviceId: 'svc_netflix',
        planName: 'Standard',
        status: 'active',
        billingAmountCents: 1549,
        billingCurrency: 'USD',
        billingInterval: 'monthly',
        nextRenewal: new Date('2026-03-18T00:00:00.000Z'),
        paymentSource: 'card',
        paymentLast4: '4242',
        autoImportSource: 'manual',
        notes: null,
        statusChangedAt: new Date('2026-03-17T00:00:00.000Z'),
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
        updatedAt: new Date('2026-03-17T00:00:00.000Z'),
        service: { name: 'Netflix' },
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/api/data/export/subscriptions?format=json')
      .expect(200);

    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body.subscriptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serviceName: 'Netflix',
          billingAmount: 15.49,
        }),
      ]),
    );
  });

  it('/api/settings (GET/PUT) reads and updates notification preferences', async () => {
    const initial = await request(app.getHttpServer())
      .get('/api/settings')
      .expect(200);

    expect(initial.body).toEqual({
      notificationPreference: {
        id: 'default',
        leadTimeDays: 7,
        channels: ['email', 'push'],
      },
      emailForwardingAlias: 'subs+general@beacon.app',
    });

    const updated = await request(app.getHttpServer())
      .put('/api/settings')
      .send({
        leadTimeDays: 3,
        channels: ['email'],
      })
      .expect(200);

    expect(updated.body).toEqual({
      notificationPreference: {
        id: 'default',
        leadTimeDays: 3,
        channels: ['email'],
      },
      emailForwardingAlias: 'subs+general@beacon.app',
    });
  });
});
