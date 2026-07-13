import { EmailIngestService } from './email-ingest.service';
import { EmailIngestPayload } from './email-ingest.controller';

describe('EmailIngestService', () => {
  const receivedAt = '2026-06-01T00:00:00.000Z';
  const receiptEntity = {
    id: 'receipt_1',
    source: 'gmail',
    externalMessageId: 'message_1',
    sender: 'info@netflix.com',
    subject: 'Your Netflix receipt',
    receivedAt: new Date(receivedAt),
    parserId: null,
    parserVersion: null,
    status: 'processing',
    overallConfidence: 0,
    bodyHash: 'hash',
    bodySnapshot: null,
    failureReason: null,
    createdAt: new Date(receivedAt),
    reviewedAt: null,
  };
  let itemSequence = 0;
  const prisma = {
    emailReceipt: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    emailReceiptItem: {
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const services = { findAll: jest.fn() };
  const subscriptions = { upsertImported: jest.fn() };
  const integrations = { recordSync: jest.fn() };
  const notificationPreferences = { getPreference: jest.fn() };
  const netflix = {
    id: 'svc_netflix',
    name: 'Netflix',
    category: 'streaming' as const,
    supportsOAuth: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    itemSequence = 0;
    prisma.emailReceipt.findUnique.mockResolvedValue(null);
    prisma.emailReceipt.create.mockResolvedValue(receiptEntity);
    prisma.emailReceipt.update.mockResolvedValue(receiptEntity);
    prisma.emailReceiptItem.create.mockImplementation(async ({ data }) => ({
      id: `item_${++itemSequence}`,
      ...data,
      serviceId: data.serviceId ?? null,
      subscriptionId: null,
      evidenceJson: data.evidenceJson ?? null,
      createdAt: new Date(receivedAt),
      updatedAt: new Date(receivedAt),
    }));
    prisma.emailReceiptItem.update.mockResolvedValue(undefined);
    prisma.emailReceiptItem.deleteMany.mockResolvedValue({ count: 0 });
    services.findAll.mockResolvedValue([netflix]);
    subscriptions.upsertImported.mockImplementation(async (input) => ({
      mode: 'created',
      subscription: {
        id: 'sub_1',
        ...input,
        status: 'active',
        nextRenewalReminderSent: false,
        statusChangedAt: receivedAt,
      },
    }));
    integrations.recordSync.mockResolvedValue(undefined);
    notificationPreferences.getPreference.mockResolvedValue({
      channels: ['push'],
    });
  });

  const createService = () =>
    new EmailIngestService(
      prisma as never,
      services as never,
      subscriptions as never,
      integrations as never,
      notificationPreferences as never,
    );

  const netflixPayload: EmailIngestPayload = {
    sender: 'info@netflix.com',
    subject: 'Your Netflix receipt',
    body: 'Netflix Standard. Total: $15.49. Renews June 15, 2026.',
    receivedAt,
  } as EmailIngestPayload;

  it('audits and imports a trusted Netflix receipt', async () => {
    const result = await createService().ingest({
      ...netflixPayload,
      source: 'gmail',
      externalMessageId: 'message_1',
      authenticatedSender: true,
    });

    expect(result.status).toBe('created');
    expect(result.receiptId).toBe('receipt_1');
    expect(subscriptions.upsertImported).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: 'svc_netflix',
        billingAmount: 15.49,
        observedAt: receivedAt,
      }),
    );
    expect(prisma.emailReceipt.update).toHaveBeenLastCalledWith({
      where: { id: 'receipt_1' },
      data: { status: 'imported' },
    });
  });

  it('routes a low-confidence generic parse to review', async () => {
    services.findAll.mockResolvedValue([netflix]);
    const result = await createService().ingest({
      sender: 'billing@example.com',
      subject: 'Subscription receipt',
      body: 'Netflix membership amount $12.00',
      receivedAt,
    });

    expect(result.status).toBe('review');
    expect(result.items[0]?.action).toBe('review');
    expect(subscriptions.upsertImported).not.toHaveBeenCalled();
  });

  it('does not auto-apply an unauthenticated provider sender from Gmail', async () => {
    const result = await createService().ingest({
      ...netflixPayload,
      source: 'gmail',
      externalMessageId: 'spoofed_message',
      authenticatedSender: false,
    });

    expect(result.status).toBe('review');
    expect(subscriptions.upsertImported).not.toHaveBeenCalled();
  });

  it('creates separate audited items for an aggregate Apple receipt', async () => {
    services.findAll.mockResolvedValue([
      {
        id: 'svc_apple_tv',
        name: 'Apple TV+',
        category: 'streaming',
        supportsOAuth: false,
      },
      {
        id: 'svc_icloud',
        name: 'iCloud+',
        category: 'other',
        supportsOAuth: false,
      },
    ]);

    const result = await createService().ingest({
      sender: 'no_reply@apple.com',
      subject: 'Your receipt from Apple',
      body: [
        'Apple TV+',
        'Monthly',
        'Renews July 1, 2026',
        '$9.99',
        'iCloud+',
        'Monthly',
        'Renews July 1, 2026',
        '$2.99',
        'Total $12.98',
      ].join('\n'),
      receivedAt,
    });

    expect(result.items).toHaveLength(2);
    expect(subscriptions.upsertImported).toHaveBeenCalledTimes(2);
    expect(result.subscriptions).toHaveLength(2);
  });

  it('returns the existing audit record for a duplicate Gmail message', async () => {
    prisma.emailReceipt.findUnique.mockResolvedValue({
      ...receiptEntity,
      parserId: 'netflix',
      items: [],
    });

    const result = await createService().ingest({
      ...netflixPayload,
      externalMessageId: 'message_1',
      source: 'gmail',
    });

    expect(result.status).toBe('duplicate');
    expect(prisma.emailReceipt.create).not.toHaveBeenCalled();
    expect(subscriptions.upsertImported).not.toHaveBeenCalled();
  });

  it('retries a previously failed Gmail receipt instead of consuming it', async () => {
    prisma.emailReceipt.findUnique.mockResolvedValue({
      ...receiptEntity,
      status: 'failed',
      failureReason: 'Temporary database error',
      items: [],
    });

    const result = await createService().ingest({
      ...netflixPayload,
      source: 'gmail',
      externalMessageId: 'message_1',
      authenticatedSender: true,
    });

    expect(result.status).toBe('created');
    expect(prisma.emailReceiptItem.deleteMany).toHaveBeenCalledWith({
      where: { receiptId: 'receipt_1' },
    });
    expect(prisma.emailReceipt.create).not.toHaveBeenCalled();
  });

  it('records an auditable failure when no subscription amount is present', async () => {
    const result = await createService().ingest({
      sender: 'info@netflix.com',
      subject: 'News from Netflix',
      body: 'Here are shows you might enjoy.',
      receivedAt,
    });

    expect(result.status).toBe('failed');
    expect(result.message).toContain('No Netflix billing amount');
    expect(prisma.emailReceipt.update).toHaveBeenLastCalledWith({
      where: { id: 'receipt_1' },
      data: {
        status: 'failed',
        failureReason: 'No Netflix billing amount was found.',
      },
    });
  });

  it('queues every enabled notification channel for a price change', async () => {
    subscriptions.upsertImported.mockImplementationOnce(async (input) => ({
      mode: 'updated',
      subscription: {
        id: 'sub_1',
        ...input,
        status: 'active',
        nextRenewalReminderSent: false,
        statusChangedAt: receivedAt,
      },
      priceChange: {
        previousAmount: 15.49,
        previousCurrency: 'USD',
        newAmount: 17.99,
        newCurrency: 'USD',
      },
    }));
    notificationPreferences.getPreference.mockResolvedValue({
      channels: ['push', 'email'],
    });

    await createService().ingest({
      ...netflixPayload,
      body: 'Netflix Standard. Total: $17.99. Renews June 15, 2026.',
    });

    expect(subscriptions.upsertImported).toHaveBeenCalledWith(
      expect.objectContaining({
        priceChangeNotification: {
          channels: ['push', 'email'],
          title: 'Netflix price changed',
        },
      }),
    );
  });

  it('reports stale receipts as ignored instead of imported', async () => {
    subscriptions.upsertImported.mockImplementationOnce(async (input) => ({
      mode: 'ignored',
      subscription: {
        id: 'sub_1',
        ...input,
        status: 'active',
        nextRenewalReminderSent: false,
        statusChangedAt: receivedAt,
      },
    }));

    const result = await createService().ingest(netflixPayload);

    expect(result.status).toBe('ignored');
    expect(result.message).toContain('Ignored an older receipt');
  });
});
