import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { EmailReceiptsService } from './email-receipts.service';

describe('EmailReceiptsService', () => {
  const receivedAt = new Date('2026-07-12T10:00:00.000Z');
  const renewalDate = new Date('2026-08-12T10:00:00.000Z');
  const baseItem = {
    id: 'item-1',
    receiptId: 'receipt-1',
    serviceId: 'netflix',
    subscriptionId: null,
    providerName: 'Netflix',
    planName: 'Standard',
    amountCents: 1599,
    currency: 'CAD',
    interval: 'monthly',
    renewalDate,
    paymentSource: null,
    paymentLast4: null,
    confidence: 62,
    action: 'review',
    evidenceJson: '["Standard","CA$15.99"]',
    createdAt: receivedAt,
    updatedAt: receivedAt,
  };
  const baseReceipt = {
    id: 'receipt-1',
    source: 'gmail',
    externalMessageId: 'gmail-1',
    sender: 'info@account.netflix.com',
    subject: 'Your Netflix receipt',
    receivedAt,
    parserId: 'netflix',
    parserVersion: 1,
    status: 'review',
    overallConfidence: 62,
    bodySnapshot: null,
    failureReason: null,
    createdAt: receivedAt,
    reviewedAt: null,
    items: [baseItem],
  };

  const prisma = {
    emailReceipt: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    emailReceiptItem: {
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const subscriptions = { upsertImported: jest.fn() };
  const integrations = { recordSync: jest.fn() };
  const notificationPreferences = { getPreference: jest.fn() };
  let service: EmailReceiptsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.emailReceiptItem.updateMany.mockResolvedValue({ count: 1 });
    notificationPreferences.getPreference.mockResolvedValue({
      channels: ['push'],
    });
    service = new EmailReceiptsService(
      prisma as unknown as PrismaService,
      subscriptions as unknown as SubscriptionsService,
      integrations as never,
      notificationPreferences as never,
    );
  });

  it('applies corrected values with receipt idempotency metadata', async () => {
    prisma.emailReceipt.findUnique.mockResolvedValue(baseReceipt);
    prisma.emailReceiptItem.findMany.mockResolvedValue([{ action: 'created' }]);
    subscriptions.upsertImported.mockResolvedValue({
      mode: 'created',
      subscription: { id: 'subscription-1' },
    });

    await service.approve('receipt-1', 'item-1', {
      planName: 'Premium',
      billingAmount: 20.99,
    });

    expect(subscriptions.upsertImported).toHaveBeenCalledWith({
      serviceId: 'netflix',
      planName: 'Premium',
      billingAmount: 20.99,
      billingCurrency: 'CAD',
      billingInterval: 'monthly',
      nextRenewal: renewalDate.toISOString(),
      paymentSource: undefined,
      paymentLast4: undefined,
      autoImportSource: 'email',
      observedAt: receivedAt.toISOString(),
      priceChangeNotification: {
        channels: ['push'],
        title: 'Netflix price changed',
      },
    });
    expect(prisma.emailReceiptItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item-1' },
        data: expect.objectContaining({
          subscriptionId: 'subscription-1',
          planName: 'Premium',
          amountCents: 2099,
          action: 'created',
        }),
      }),
    );
    expect(prisma.emailReceipt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'receipt-1' },
        data: expect.objectContaining({ status: 'imported' }),
      }),
    );
  });

  it('rejects the final pending item and closes the receipt', async () => {
    prisma.emailReceipt.findUnique.mockResolvedValue(baseReceipt);
    prisma.emailReceiptItem.findMany.mockResolvedValue([
      { action: 'rejected' },
    ]);

    await service.reject('receipt-1', 'item-1');

    expect(prisma.emailReceiptItem.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'item-1',
        receiptId: 'receipt-1',
        action: 'review',
      },
      data: { action: 'rejected' },
    });
    expect(prisma.emailReceipt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'receipt-1' },
        data: expect.objectContaining({ status: 'rejected' }),
      }),
    );
  });

  it('does not apply an item that was already reviewed', async () => {
    prisma.emailReceipt.findUnique.mockResolvedValue({
      ...baseReceipt,
      items: [{ ...baseItem, action: 'updated' }],
    });

    await expect(
      service.approve('receipt-1', 'item-1', {}),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(subscriptions.upsertImported).not.toHaveBeenCalled();
  });
});
