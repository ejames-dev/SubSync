import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  BillingInterval,
  EmailIngestResult,
  EmailReceiptItem,
  ServiceProvider,
  Subscription,
} from '@subscription-tracker/types';
import { EmailIngestPayload } from './email-ingest.controller';
import { parseEmailReceipt } from './parsers';
import { IntegrationsService } from '../integrations/integrations.service';
import { NotificationPreferencesService } from '../notifications/notification-preferences.service';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceCatalogService } from '../service-catalog/service-catalog.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { EmailReceipt as PrismaEmailReceipt } from '../../prisma/generated/client';

type IngestRequest = EmailIngestPayload & {
  externalMessageId?: string;
  source?: 'gmail' | 'manual';
  authenticatedSender?: boolean;
};

type AppliedItem = {
  item: EmailReceiptItem;
  subscription?: Subscription;
};

@Injectable()
export class EmailIngestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServiceCatalogService,
    private readonly subscriptions: SubscriptionsService,
    private readonly integrations: IntegrationsService,
    private readonly notificationPreferences: NotificationPreferencesService,
  ) {}

  async ingest(payload: IngestRequest): Promise<EmailIngestResult> {
    let retryReceipt: PrismaEmailReceipt | undefined;
    if (payload.externalMessageId) {
      const duplicate = await this.prisma.emailReceipt.findUnique({
        where: { externalMessageId: payload.externalMessageId },
        include: { items: true },
      });
      if (duplicate) {
        if (duplicate.status === 'failed') {
          await this.prisma.emailReceiptItem.deleteMany({
            where: { receiptId: duplicate.id },
          });
          retryReceipt = await this.prisma.emailReceipt.update({
            where: { id: duplicate.id },
            data: {
              status: 'processing',
              failureReason: null,
              reviewedAt: null,
            },
          });
        } else {
          return {
            status: 'duplicate',
            inferredProvider: duplicate.parserId ?? 'unknown',
            subscriptions: [],
            receiptId: duplicate.id,
            items: duplicate.items.map((item) => this.toReceiptItem(item)),
            message: 'This email receipt has already been processed.',
            receivedAt: duplicate.receivedAt.toISOString(),
          };
        }
      }
    }

    const body = payload.body ?? '';
    const receipt =
      retryReceipt ??
      (await this.prisma.emailReceipt.create({
        data: {
          source: payload.source ?? 'manual',
          externalMessageId: payload.externalMessageId,
          sender: payload.sender,
          subject: payload.subject,
          receivedAt: new Date(payload.receivedAt),
          bodyHash: createHash('sha256').update(body).digest('hex'),
          bodySnapshot:
            process.env.EMAIL_RECEIPT_STORE_BODY_SNAPSHOT === 'true'
              ? this.sanitizeSnapshot(body)
              : undefined,
        },
      }));

    try {
      const parsed = parseEmailReceipt(payload);
      if (parsed.items.length === 0) {
        throw new Error(
          parsed.warnings[0] ??
            'No subscription items were found in the receipt.',
        );
      }
      const catalog = await this.services.findAll();
      const notificationPreference =
        await this.notificationPreferences.getPreference();
      const applied: AppliedItem[] = [];

      await this.prisma.emailReceipt.update({
        where: { id: receipt.id },
        data: {
          parserId: parsed.parserId,
          parserVersion: parsed.parserVersion,
          overallConfidence: this.toConfidencePercent(parsed.confidence),
        },
      });

      for (const parsedItem of parsed.items) {
        const service = this.resolveService(parsedItem.providerName, catalog);
        const confidence = this.toConfidencePercent(parsedItem.confidence);
        const autoApprove =
          service !== undefined &&
          confidence >= this.autoApproveThreshold() &&
          (payload.source !== 'gmail' || payload.authenticatedSender === true);
        const nextRenewal =
          parsedItem.nextRenewal ??
          this.inferNextRenewal(
            payload.receivedAt,
            parsedItem.billingInterval ?? 'monthly',
          );
        const createdItem = await this.prisma.emailReceiptItem.create({
          data: {
            receiptId: receipt.id,
            serviceId: service?.id,
            providerName: parsedItem.providerName,
            planName: parsedItem.planName,
            amountCents: Math.round(parsedItem.billingAmount * 100),
            currency: parsedItem.billingCurrency,
            interval: parsedItem.billingInterval ?? 'monthly',
            renewalDate: new Date(nextRenewal),
            paymentSource: parsedItem.paymentSource,
            paymentLast4: parsedItem.paymentLast4,
            confidence,
            action: 'review',
            evidenceJson: JSON.stringify(
              Object.values(parsedItem.evidence).filter(
                (value): value is string => typeof value === 'string',
              ),
            ),
          },
        });

        if (!autoApprove || !service) {
          applied.push({ item: this.toReceiptItem(createdItem) });
          continue;
        }

        const saved = await this.subscriptions.upsertImported({
          serviceId: service.id,
          planName: parsedItem.planName,
          billingAmount: parsedItem.billingAmount,
          billingCurrency: parsedItem.billingCurrency,
          billingInterval: (parsedItem.billingInterval ??
            'monthly') as BillingInterval,
          nextRenewal,
          paymentSource: parsedItem.paymentSource,
          paymentLast4: parsedItem.paymentLast4,
          notes: `Imported from ${parsed.parserId} receipt "${payload.subject}" on ${payload.receivedAt}`,
          autoImportSource: 'email',
          observedAt: payload.receivedAt,
          priceChangeNotification: {
            channels: notificationPreference.channels,
            title: `${parsedItem.providerName} price changed`,
          },
        });

        await this.prisma.emailReceiptItem.update({
          where: { id: createdItem.id },
          data: {
            subscriptionId: saved.subscription.id,
            action: saved.mode,
          },
        });
        await Promise.allSettled([
          this.integrations.recordSync(service.id, 'email'),
        ]);

        applied.push({
          item: this.toReceiptItem({
            ...createdItem,
            subscriptionId: saved.subscription.id,
            action: saved.mode,
            updatedAt: new Date(),
          }),
          subscription: saved.subscription,
        });
      }

      const subscriptions = applied.flatMap((result) =>
        result.subscription ? [result.subscription] : [],
      );
      const reviewCount = applied.filter(
        (result) => result.item.action === 'review',
      ).length;
      const ignoredCount = applied.filter(
        (result) => result.item.action === 'ignored',
      ).length;
      const status =
        reviewCount === applied.length
          ? 'review'
          : reviewCount > 0
            ? 'mixed'
            : ignoredCount === applied.length
              ? 'ignored'
              : applied.some((result) => result.item.action === 'created')
                ? 'created'
                : 'updated';

      await this.prisma.emailReceipt.update({
        where: { id: receipt.id },
        data: { status: reviewCount > 0 ? 'review' : 'imported' },
      });

      return {
        status,
        inferredProvider: parsed.items[0]?.providerName ?? parsed.parserId,
        subscription: subscriptions[0],
        subscriptions,
        receiptId: receipt.id,
        items: applied.map((result) => result.item),
        message:
          reviewCount > 0
            ? `${reviewCount} parsed item${reviewCount === 1 ? '' : 's'} need review.`
            : ignoredCount === applied.length
              ? 'Ignored an older receipt because newer billing data is already saved.'
              : `Imported ${subscriptions.length} subscription${subscriptions.length === 1 ? '' : 's'} from ${parsed.parserId}.`,
        receivedAt: payload.receivedAt,
      };
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : 'Receipt parsing failed.';
      await this.prisma.emailReceipt.update({
        where: { id: receipt.id },
        data: { status: 'failed', failureReason },
      });
      return {
        status: 'failed',
        inferredProvider: 'unknown',
        subscriptions: [],
        receiptId: receipt.id,
        items: [],
        message: failureReason,
        receivedAt: payload.receivedAt,
      };
    }
  }

  private resolveService(
    providerName: string,
    catalog: ServiceProvider[],
  ): ServiceProvider | undefined {
    const normalizedProvider = this.normalizeName(providerName);
    return catalog.find((service) => {
      const normalizedService = this.normalizeName(service.name);
      return (
        normalizedService === normalizedProvider ||
        normalizedProvider.includes(normalizedService) ||
        normalizedService.includes(normalizedProvider)
      );
    });
  }

  private normalizeName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private autoApproveThreshold(): number {
    const configured = Number(
      process.env.EMAIL_IMPORT_AUTO_APPROVE_CONFIDENCE ?? '90',
    );
    return Number.isFinite(configured)
      ? Math.min(Math.max(Math.round(configured), 0), 100)
      : 90;
  }

  private toConfidencePercent(confidence: number): number {
    const normalized = confidence <= 1 ? confidence * 100 : confidence;
    return Math.min(Math.max(Math.round(normalized), 0), 100);
  }

  private inferNextRenewal(
    receivedAt: string,
    interval: 'monthly' | 'quarterly' | 'yearly',
  ): string {
    const next = new Date(receivedAt);
    if (interval === 'yearly') {
      next.setFullYear(next.getFullYear() + 1);
    } else if (interval === 'quarterly') {
      next.setMonth(next.getMonth() + 3);
    } else {
      next.setMonth(next.getMonth() + 1);
    }
    return next.toISOString();
  }

  private sanitizeSnapshot(body: string): string | undefined {
    if (!body) {
      return undefined;
    }
    return body
      .slice(0, 4000)
      .replace(
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
        '[email redacted]',
      )
      .replace(
        /\b(?:phone|tel(?:ephone)?)\s*:?\s*\+?\d[\d ().-]{8,}\d/gi,
        '[phone redacted]',
      )
      .replace(/\b(?:\d[ -]*?){12,19}\b/g, '[payment number redacted]')
      .replace(
        /\b(card|visa|mastercard|amex)(\s+(?:ending in|last four|last 4))?\s*[*x-]*\d{4}\b/gi,
        '$1 ending in [redacted]',
      );
  }

  private toReceiptItem(record: {
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
      id: record.id,
      receiptId: record.receiptId,
      serviceId: record.serviceId ?? undefined,
      subscriptionId: record.subscriptionId ?? undefined,
      providerName: record.providerName,
      planName: record.planName,
      billingAmount: record.amountCents / 100,
      billingCurrency: record.currency,
      billingInterval: this.toBillingInterval(record.interval),
      nextRenewal: record.renewalDate.toISOString(),
      paymentSource: this.toPaymentSource(record.paymentSource),
      paymentLast4: record.paymentLast4 ?? undefined,
      confidence: record.confidence,
      action: this.toItemAction(record.action),
      evidence: this.parseEvidence(record.evidenceJson),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private parseEvidence(value: string | null): string[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : [];
    } catch {
      return [];
    }
  }

  private toBillingInterval(value: string): BillingInterval {
    if (value === 'yearly' || value === 'quarterly' || value === 'custom') {
      return value;
    }
    return 'monthly';
  }

  private toItemAction(value: string): EmailReceiptItem['action'] {
    if (
      value === 'created' ||
      value === 'updated' ||
      value === 'ignored' ||
      value === 'rejected'
    ) {
      return value;
    }
    return 'review';
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
