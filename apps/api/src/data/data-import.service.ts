import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BillingInterval,
  ServiceProvider,
  Subscription,
  SubscriptionImportColumnMap,
  SubscriptionImportResult,
  SubscriptionStatus,
} from '@subscription-tracker/types';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceCatalogService } from '../service-catalog/service-catalog.service';
import { parseCsvRecords } from './csv.util';

interface RawImportRow {
  id?: string;
  serviceId?: string;
  serviceName?: string;
  planName?: string;
  status?: string;
  billingAmount?: string | number;
  billingCurrency?: string;
  billingInterval?: string;
  nextRenewal?: string;
  paymentSource?: string;
  paymentLast4?: string;
  notes?: string;
}

@Injectable()
export class DataImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceCatalog: ServiceCatalogService,
  ) {}

  async importSubscriptions(input: {
    content: string;
    format?: 'csv' | 'json';
    columnMap?: SubscriptionImportColumnMap;
  }): Promise<SubscriptionImportResult> {
    const trimmed = input.content.trim();
    if (!trimmed) {
      throw new BadRequestException('Import payload cannot be empty.');
    }

    const format =
      input.format ??
      (trimmed.startsWith('{') || trimmed.startsWith('[') ? 'json' : 'csv');

    const rows =
      format === 'json'
        ? this.extractJsonRows(trimmed)
        : this.extractCsvRows(trimmed, input.columnMap);

    let catalog = await this.serviceCatalog.findAll();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowLabel = `Row ${index + 1}`;
      try {
        const service = await this.resolveOrCreateService(row, catalog);
        if (!catalog.some((entry) => entry.id === service.id)) {
          catalog = [...catalog, service];
        }

        const cleanedAmount = String(row.billingAmount ?? '')
          .replace(/[^0-9.-]/g, '')
          .trim();
        const amount =
          cleanedAmount.length > 0 ? Number(cleanedAmount) : Number.NaN;
        if (!Number.isFinite(amount) || amount < 0) {
          errors.push(
            `${rowLabel}: invalid billingAmount "${row.billingAmount ?? ''}"`,
          );
          skipped += 1;
          continue;
        }

        const renewalDate = this.parseDateOrDefault(row.nextRenewal);
        const planName = (row.planName ?? '').trim() || `${service.name} Plan`;
        const currency = (
          (row.billingCurrency ?? 'USD').trim().slice(0, 3) || 'USD'
        ).toUpperCase();
        const interval = this.normalizeInterval(row.billingInterval);
        const status = this.normalizeStatus(row.status);
        const paymentSource = this.normalizePaymentSource(row.paymentSource);
        const paymentLast4 =
          row.paymentLast4 && /^\d{4}$/.test(row.paymentLast4.trim())
            ? row.paymentLast4.trim()
            : null;
        const notes = row.notes?.trim() ? row.notes.trim() : null;

        const existingById = row.id
          ? await this.prisma.subscription.findUnique({
              where: { id: row.id },
            })
          : null;
        const existing =
          existingById ??
          (await this.prisma.subscription.findFirst({
            where: { serviceId: service.id, planName },
          }));

        if (existing) {
          await this.prisma.subscription.update({
            where: { id: existing.id },
            data: {
              serviceId: service.id,
              planName,
              status,
              billingAmountCents: Math.round(amount * 100),
              billingCurrency: currency,
              billingInterval: interval,
              nextRenewal: renewalDate,
              paymentSource,
              paymentLast4,
              notes: notes ?? existing.notes,
            },
          });
          updated += 1;
        } else {
          const createdSub = await this.prisma.subscription.create({
            data: {
              ...(row.id ? { id: row.id } : {}),
              serviceId: service.id,
              planName,
              status,
              billingAmountCents: Math.round(amount * 100),
              billingCurrency: currency,
              billingInterval: interval,
              nextRenewal: renewalDate,
              paymentSource,
              paymentLast4,
              autoImportSource: 'manual',
              notes,
            },
          });
          await this.prisma.subscriptionEvent.create({
            data: {
              subscriptionId: createdSub.id,
              eventType: 'created',
              status,
              notes: `Imported from ${format.toUpperCase()}`,
            },
          });
          created += 1;
        }
      } catch (err) {
        errors.push(
          `${rowLabel}: ${err instanceof Error ? err.message : 'Unexpected import error'}`,
        );
        skipped += 1;
      }
    }

    return { created, updated, skipped, errors };
  }

  private extractJsonRows(raw: string): RawImportRow[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException('Invalid JSON subscription import file.');
    }

    if (Array.isArray(parsed)) {
      return parsed as RawImportRow[];
    }
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { subscriptions?: unknown }).subscriptions)
    ) {
      return (parsed as { subscriptions: RawImportRow[] }).subscriptions;
    }
    throw new BadRequestException(
      'JSON import must be an array or an object with a "subscriptions" array.',
    );
  }

  private extractCsvRows(
    raw: string,
    columnMap?: SubscriptionImportColumnMap,
  ): RawImportRow[] {
    const { headers, rows } = parseCsvRecords(raw);
    if (headers.length === 0) {
      throw new BadRequestException('CSV import file has no header row.');
    }

    const findCol = (
      explicit: string | undefined,
      aliases: string[],
    ): string | undefined => {
      if (explicit && headers.includes(explicit)) {
        return explicit;
      }
      const lowerMap = new Map(
        headers.map((h) => [h.toLowerCase().replace(/[^a-z0-9]/g, ''), h]),
      );
      for (const alias of aliases) {
        const hit = lowerMap.get(alias.toLowerCase().replace(/[^a-z0-9]/g, ''));
        if (hit) return hit;
      }
      return undefined;
    };

    const idCol = findCol(undefined, ['id']);
    const serviceIdCol = findCol(undefined, ['serviceid']);
    const serviceNameCol = findCol(columnMap?.serviceName, [
      'servicename',
      'service',
      'provider',
      'merchant',
      'name',
    ]);
    const planNameCol = findCol(columnMap?.planName, [
      'planname',
      'plan',
      'tier',
    ]);
    const amountCol = findCol(columnMap?.billingAmount, [
      'billingamount',
      'amount',
      'price',
      'cost',
    ]);
    const currencyCol = findCol(columnMap?.billingCurrency, [
      'billingcurrency',
      'currency',
    ]);
    const intervalCol = findCol(columnMap?.billingInterval, [
      'billinginterval',
      'interval',
      'cadence',
      'frequency',
      'cycle',
    ]);
    const renewalCol = findCol(columnMap?.nextRenewal, [
      'nextrenewal',
      'renewaldate',
      'nextbillingdate',
      'duedate',
      'date',
    ]);
    const statusCol = findCol(columnMap?.status, ['status', 'state']);
    const paymentSourceCol = findCol(columnMap?.paymentSource, [
      'paymentsource',
      'paymentmethod',
    ]);
    const paymentLast4Col = findCol(columnMap?.paymentLast4, [
      'paymentlast4',
      'last4',
    ]);
    const notesCol = findCol(columnMap?.notes, ['notes', 'note', 'memo']);

    return rows.map((record) => ({
      id: idCol ? record[idCol] || undefined : undefined,
      serviceId: serviceIdCol ? record[serviceIdCol] || undefined : undefined,
      serviceName: serviceNameCol ? record[serviceNameCol] : undefined,
      planName: planNameCol ? record[planNameCol] : undefined,
      billingAmount: amountCol ? record[amountCol] : undefined,
      billingCurrency: currencyCol ? record[currencyCol] : undefined,
      billingInterval: intervalCol ? record[intervalCol] : undefined,
      nextRenewal: renewalCol ? record[renewalCol] : undefined,
      status: statusCol ? record[statusCol] : undefined,
      paymentSource: paymentSourceCol ? record[paymentSourceCol] : undefined,
      paymentLast4: paymentLast4Col ? record[paymentLast4Col] : undefined,
      notes: notesCol ? record[notesCol] : undefined,
    }));
  }

  private async resolveOrCreateService(
    row: RawImportRow,
    catalog: ServiceProvider[],
  ): Promise<ServiceProvider> {
    if (row.serviceId) {
      const byId = catalog.find((s) => s.id === row.serviceId);
      if (byId) return byId;
    }

    const rawName = (row.serviceName ?? row.planName ?? '').trim();
    if (!rawName) {
      throw new Error('Missing serviceName or serviceId');
    }

    const norm = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = catalog.find(
      (s) => s.name.toLowerCase().replace(/[^a-z0-9]/g, '') === norm,
    );
    if (match) return match;

    return this.serviceCatalog.createCustom({
      name: rawName.slice(0, 80),
      category: 'other',
    });
  }

  private parseDateOrDefault(raw?: string): Date {
    if (raw && raw.trim()) {
      const candidate = new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())
          ? `${raw.trim()}T00:00:00.000Z`
          : raw.trim(),
      );
      if (!Number.isNaN(candidate.getTime())) {
        return candidate;
      }
    }
    const fallback = new Date();
    fallback.setUTCMonth(fallback.getUTCMonth() + 1);
    return fallback;
  }

  private normalizeInterval(raw?: string): BillingInterval {
    const v = (raw ?? '').trim().toLowerCase();
    if (v.startsWith('week')) return 'weekly';
    if (v.startsWith('year') || v.startsWith('annual')) return 'yearly';
    if (v.startsWith('quarter')) return 'quarterly';
    if (v === 'custom') return 'custom';
    return 'monthly';
  }

  private normalizeStatus(raw?: string): SubscriptionStatus {
    const v = (raw ?? '').trim().toLowerCase();
    if (
      v === 'active' ||
      v === 'trial' ||
      v === 'paused' ||
      v === 'flagged_for_cancellation' ||
      v === 'canceled_pending' ||
      v === 'canceled'
    ) {
      return v;
    }
    return 'active';
  }

  private normalizePaymentSource(
    raw?: string,
  ): Subscription['paymentSource'] | null {
    const v = (raw ?? '').trim().toLowerCase();
    if (v === 'card' || v === 'paypal' || v === 'gift' || v === 'other') {
      return v;
    }
    return null;
  }
}
