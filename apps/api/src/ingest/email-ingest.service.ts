import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingInterval,
  EmailIngestResult,
  ServiceProvider,
  Subscription,
} from '@subscription-tracker/types';
import { EmailIngestPayload } from './email-ingest.controller';
import { ServiceCatalogService } from '../service-catalog/service-catalog.service';
import { STREAMING_SERVICES } from '../service-catalog/service-catalog.data';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { IntegrationsService } from '../integrations/integrations.service';

type ParsedEmailSubscription = {
  service: ServiceProvider;
  planName: string;
  billingAmount: number;
  billingCurrency: string;
  billingInterval: BillingInterval;
  nextRenewal: string;
  paymentSource?: Subscription['paymentSource'];
  paymentLast4?: string;
  notes?: string;
};

@Injectable()
export class EmailIngestService {
  constructor(
    private readonly services: ServiceCatalogService,
    private readonly subscriptions: SubscriptionsService,
    private readonly integrations: IntegrationsService,
  ) {}

  async ingest(payload: EmailIngestPayload): Promise<EmailIngestResult> {
    const parsed = await this.parseEmail(payload);
    const saved = await this.subscriptions.upsertImported({
      serviceId: parsed.service.id,
      planName: parsed.planName,
      billingAmount: parsed.billingAmount,
      billingCurrency: parsed.billingCurrency,
      billingInterval: parsed.billingInterval,
      nextRenewal: parsed.nextRenewal,
      paymentSource: parsed.paymentSource,
      paymentLast4: parsed.paymentLast4,
      notes: parsed.notes,
      autoImportSource: 'email',
    });
    await this.integrations.recordSync(parsed.service.id, 'email');

    return {
      status: saved.mode,
      inferredProvider: parsed.service.name,
      subscription: saved.subscription,
      message: `${saved.mode === 'created' ? 'Created' : 'Updated'} ${
        parsed.service.name
      } from email import.`,
      receivedAt: payload.receivedAt,
    };
  }

  private async parseEmail(
    payload: EmailIngestPayload,
  ): Promise<ParsedEmailSubscription> {
    const haystack = `${payload.sender}\n${payload.subject}\n${payload.body ?? ''}`;
    const service = await this.resolveService(haystack);
    if (!service) {
      throw new NotFoundException(
        'Could not infer a supported provider from the email.',
      );
    }

    const billingCurrency = this.detectCurrency(haystack);
    const billingAmount = this.detectAmount(haystack);
    const billingInterval = this.detectInterval(haystack);
    const nextRenewal = this.detectRenewalDate(
      haystack,
      payload.receivedAt,
      billingInterval,
    );
    const paymentSource = this.detectPaymentSource(haystack);
    const paymentLast4 = this.detectPaymentLast4(haystack);

    return {
      service,
      planName: this.detectPlanName(haystack, service.name),
      billingAmount,
      billingCurrency,
      billingInterval,
      nextRenewal,
      paymentSource,
      paymentLast4,
      notes: `Imported from email "${payload.subject}" on ${payload.receivedAt}`,
    };
  }

  private async resolveService(
    content: string,
  ): Promise<ServiceProvider | undefined> {
    const catalog = await this.services.findAll();
    const normalized = content.toLowerCase();

    return [...catalog, ...STREAMING_SERVICES].find((service) =>
      normalized.includes(service.name.toLowerCase().replace('+', '')),
    );
  }

  private detectCurrency(content: string): string {
    if (content.includes('€') || /\bEUR\b/i.test(content)) {
      return 'EUR';
    }
    if (content.includes('£') || /\bGBP\b/i.test(content)) {
      return 'GBP';
    }
    return 'USD';
  }

  private detectAmount(content: string): number {
    const amountMatch =
      content.match(/(?:USD|EUR|GBP|\$|€|£)\s?(\d+(?:\.\d{2})?)/i) ??
      content.match(/\b(\d+(?:\.\d{2})?)\s?(?:USD|EUR|GBP)\b/i) ??
      content.match(/\bamount[:\s]+(\d+(?:\.\d{2})?)\b/i);

    return amountMatch ? Number(amountMatch[1]) : 9.99;
  }

  private detectInterval(content: string): BillingInterval {
    const normalized = content.toLowerCase();
    if (normalized.includes('annual') || normalized.includes('yearly')) {
      return 'yearly';
    }
    if (normalized.includes('quarterly')) {
      return 'quarterly';
    }
    return 'monthly';
  }

  private detectRenewalDate(
    content: string,
    receivedAt: string,
    interval: BillingInterval,
  ): string {
    const normalized = content.replace(/\n/g, ' ');
    const dateMatch =
      normalized.match(
        /\b(?:renews?|next billing date|next charge|billing date)[:\s]+([A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4})/i,
      ) ??
      normalized.match(
        /\b(?:renews?|next billing date|next charge|billing date)[:\s]+(\d{4}-\d{2}-\d{2})/i,
      );

    if (dateMatch) {
      const parsed = new Date(dateMatch[1]);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }

    const base = new Date(receivedAt);
    const next = new Date(base);
    if (interval === 'yearly') {
      next.setFullYear(next.getFullYear() + 1);
    } else if (interval === 'quarterly') {
      next.setMonth(next.getMonth() + 3);
    } else {
      next.setMonth(next.getMonth() + 1);
    }
    return next.toISOString();
  }

  private detectPlanName(content: string, serviceName: string): string {
    const normalized = content.toLowerCase();
    const knownPlans = [
      'premium',
      'family',
      'duo',
      'basic',
      'standard',
      'ad-supported',
      'bundle',
    ];
    const matched = knownPlans.find((plan) => normalized.includes(plan));
    return matched
      ? `${serviceName} ${matched.replace(/\b\w/g, (char) => char.toUpperCase())}`
      : `${serviceName} Imported Plan`;
  }

  private detectPaymentSource(
    content: string,
  ): Subscription['paymentSource'] | undefined {
    const normalized = content.toLowerCase();
    if (normalized.includes('paypal')) {
      return 'paypal';
    }
    if (
      normalized.includes('visa') ||
      normalized.includes('mastercard') ||
      normalized.includes('amex') ||
      normalized.includes('card')
    ) {
      return 'card';
    }
    return undefined;
  }

  private detectPaymentLast4(content: string): string | undefined {
    const match =
      content.match(
        /\b(?:ending in|last 4|last four|card ending in)\s*(\d{4})\b/i,
      ) ?? content.match(/\*{2,}\s*(\d{4})\b/);
    return match?.[1];
  }
}
