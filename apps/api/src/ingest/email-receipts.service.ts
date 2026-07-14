import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingInterval,
  EmailReceipt,
  EmailReceiptItem,
  EmailReceiptItemAction,
  EmailReceiptStatus,
} from '@subscription-tracker/types';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { NotificationPreferencesService } from '../notifications/notification-preferences.service';
import { ReviewEmailReceiptItemDto } from './dto/review-email-receipt-item.dto';

const receiptInclude = {
  items: { orderBy: { createdAt: 'asc' as const } },
};

@Injectable()
export class EmailReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly integrations: IntegrationsService,
    private readonly notificationPreferences: NotificationPreferencesService,
  ) {}

  async list(status?: EmailReceiptStatus): Promise<EmailReceipt[]> {
    await this.recoverStaleClaims();
    const receipts = await this.prisma.emailReceipt.findMany({
      where: status ? { status } : undefined,
      include: receiptInclude,
      orderBy: { receivedAt: 'desc' },
    });
    return receipts.map((receipt) => this.toDomain(receipt));
  }

  async findOne(id: string): Promise<EmailReceipt> {
    await this.recoverStaleClaims();
    const receipt = await this.getReceiptOrThrow(id);
    return this.toDomain(receipt);
  }

  async approve(
    receiptId: string,
    itemId: string,
    dto: ReviewEmailReceiptItemDto,
  ): Promise<EmailReceipt> {
    const receipt = await this.getReceiptOrThrow(receiptId);
    const item = receipt.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      throw new NotFoundException(
        `Email receipt item ${itemId} not found on receipt ${receiptId}`,
      );
    }
    this.assertReviewable(item.action, itemId);

    const serviceId = dto.serviceId ?? item.serviceId;
    if (!serviceId) {
      throw new BadRequestException(
        'serviceId is required to approve this receipt item',
      );
    }

    const planName = dto.planName ?? item.planName;
    const billingAmount = dto.billingAmount ?? item.amountCents / 100;
    const billingCurrency = dto.billingCurrency ?? item.currency;
    const billingInterval =
      dto.billingInterval ?? (item.interval as BillingInterval);
    const nextRenewal = dto.nextRenewal ?? item.renewalDate.toISOString();

    const preference = await this.notificationPreferences.getPreference();
    const importInput: Parameters<SubscriptionsService['upsertImported']>[0] = {
      serviceId,
      planName,
      billingAmount,
      billingCurrency,
      billingInterval,
      nextRenewal,
      paymentSource: this.toPaymentSource(item.paymentSource),
      paymentLast4: item.paymentLast4 ?? undefined,
      autoImportSource: 'email' as const,
      observedAt: receipt.receivedAt.toISOString(),
      priceChangeNotification: {
        channels: preference.channels,
        title: `${item.providerName} price changed`,
      },
    };
    const claimed = await this.prisma.emailReceiptItem.updateMany({
      where: { id: item.id, receiptId, action: 'review' },
      data: { action: 'processing' },
    });
    if (claimed.count !== 1) {
      throw new ConflictException(
        `Email receipt item ${itemId} is already being reviewed`,
      );
    }
    try {
      const applied = await this.subscriptions.upsertImported(importInput);
      await this.prisma.emailReceiptItem.update({
        where: { id: item.id },
        data: {
          serviceId,
          subscriptionId: applied.subscription.id,
          planName,
          amountCents: Math.round(billingAmount * 100),
          currency: billingCurrency,
          interval: billingInterval,
          renewalDate: new Date(nextRenewal),
          action: applied.mode,
        },
      });
      await this.refreshReceiptStatus(receiptId);
      await Promise.allSettled([
        this.integrations.recordSync(serviceId, 'email'),
      ]);
      return this.findOne(receiptId);
    } catch (error) {
      await this.prisma.emailReceiptItem.updateMany({
        where: { id: item.id, action: 'processing' },
        data: { action: 'review' },
      });
      throw error;
    }
  }

  async reject(receiptId: string, itemId: string): Promise<EmailReceipt> {
    const receipt = await this.getReceiptOrThrow(receiptId);
    const item = receipt.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      throw new NotFoundException(
        `Email receipt item ${itemId} not found on receipt ${receiptId}`,
      );
    }
    this.assertReviewable(item.action, itemId);

    const rejected = await this.prisma.emailReceiptItem.updateMany({
      where: { id: item.id, receiptId, action: 'review' },
      data: { action: 'rejected' },
    });
    if (rejected.count !== 1) {
      throw new ConflictException(
        `Email receipt item ${itemId} is already being reviewed`,
      );
    }
    await this.refreshReceiptStatus(receiptId);
    return this.findOne(receiptId);
  }

  private async getReceiptOrThrow(id: string) {
    const receipt = await this.prisma.emailReceipt.findUnique({
      where: { id },
      include: receiptInclude,
    });
    if (!receipt) {
      throw new NotFoundException(`Email receipt ${id} not found`);
    }
    return receipt;
  }

  private async recoverStaleClaims(): Promise<void> {
    const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
    await this.prisma.emailReceiptItem.updateMany({
      where: { action: 'processing', updatedAt: { lt: staleBefore } },
      data: { action: 'review' },
    });
  }

  private assertReviewable(action: string, itemId: string): void {
    if (action !== 'review') {
      throw new ConflictException(
        `Email receipt item ${itemId} has already been ${action}`,
      );
    }
  }

  private async refreshReceiptStatus(receiptId: string): Promise<void> {
    const items = await this.prisma.emailReceiptItem.findMany({
      where: { receiptId },
      select: { action: true },
    });
    const hasPending = items.some((item) => item.action === 'review');
    if (hasPending) return;

    const hasImported = items.some(
      (item) =>
        item.action === 'created' ||
        item.action === 'updated' ||
        item.action === 'ignored',
    );
    await this.prisma.emailReceipt.update({
      where: { id: receiptId },
      data: {
        status: hasImported ? 'imported' : 'rejected',
        reviewedAt: new Date(),
      },
    });
  }

  private toDomain(receipt: {
    id: string;
    source: string;
    externalMessageId: string | null;
    sender: string;
    subject: string;
    receivedAt: Date;
    parserId: string | null;
    parserVersion: number | null;
    status: string;
    overallConfidence: number;
    bodySnapshot: string | null;
    failureReason: string | null;
    createdAt: Date;
    reviewedAt: Date | null;
    items: Array<{
      id: string;
      receiptId: string;
      serviceId: string | null;
      subscriptionId: string | null;
      providerName: string;
      planName: string;
      amountCents: number;
      currency: string;
      interval: string;
      renewalDate: Date;
      paymentSource: string | null;
      paymentLast4: string | null;
      confidence: number;
      action: string;
      evidenceJson: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }): EmailReceipt {
    return {
      id: receipt.id,
      source: receipt.source as EmailReceipt['source'],
      externalMessageId: receipt.externalMessageId ?? undefined,
      sender: receipt.sender,
      subject: receipt.subject,
      receivedAt: receipt.receivedAt.toISOString(),
      parserId: receipt.parserId ?? undefined,
      parserVersion: receipt.parserVersion ?? undefined,
      status: receipt.status as EmailReceiptStatus,
      confidence: receipt.overallConfidence,
      bodySnapshot: receipt.bodySnapshot ?? undefined,
      failureReason: receipt.failureReason ?? undefined,
      createdAt: receipt.createdAt.toISOString(),
      reviewedAt: receipt.reviewedAt?.toISOString(),
      items: receipt.items.map((item) => this.toItemDomain(item)),
    };
  }

  private toItemDomain(item: {
    id: string;
    receiptId: string;
    serviceId: string | null;
    subscriptionId: string | null;
    providerName: string;
    planName: string;
    amountCents: number;
    currency: string;
    interval: string;
    renewalDate: Date;
    paymentSource: string | null;
    paymentLast4: string | null;
    confidence: number;
    action: string;
    evidenceJson: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): EmailReceiptItem {
    return {
      id: item.id,
      receiptId: item.receiptId,
      serviceId: item.serviceId ?? undefined,
      subscriptionId: item.subscriptionId ?? undefined,
      providerName: item.providerName,
      planName: item.planName,
      billingAmount: item.amountCents / 100,
      billingCurrency: item.currency,
      billingInterval: item.interval as BillingInterval,
      nextRenewal: item.renewalDate.toISOString(),
      paymentSource: this.toPaymentSource(item.paymentSource),
      paymentLast4: item.paymentLast4 ?? undefined,
      confidence: item.confidence,
      action: item.action as EmailReceiptItemAction,
      evidence: this.parseEvidence(item.evidenceJson),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private parseEvidence(value: string | null): string[] {
    if (!value) return [];
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((entry): entry is string => typeof entry === 'string')
        : [];
    } catch {
      return [];
    }
  }

  private toPaymentSource(
    value: string | null,
  ): EmailReceiptItem['paymentSource'] {
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
