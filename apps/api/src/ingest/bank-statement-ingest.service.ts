import { createHash } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BankCsvIngestResult,
  BillingInterval,
  EmailReceiptItem,
  ServiceProvider,
} from '@subscription-tracker/types';
import { advanceRenewalDate } from '../common/billing-interval.util';
import { parseCsvRecords } from '../data/csv.util';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceCatalogService } from '../service-catalog/service-catalog.service';

interface ChargeRow {
  date: Date;
  rawDescription: string;
  merchantKey: string;
  merchantDisplay: string;
  amount: number;
  currency: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class BankStatementIngestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServiceCatalogService,
  ) {}

  async analyzeCsv(
    rawCsv: string,
    defaultCurrency = 'USD',
  ): Promise<BankCsvIngestResult> {
    const { headers, rows } = parseCsvRecords(rawCsv);
    if (headers.length === 0 || rows.length === 0) {
      throw new BadRequestException(
        'Bank statement CSV contains no transactions.',
      );
    }

    const findCol = (aliases: string[]) => {
      const lower = new Map(
        headers.map((h) => [h.toLowerCase().replace(/[^a-z0-9]/g, ''), h]),
      );
      for (const alias of aliases) {
        const hit = lower.get(alias);
        if (hit) return hit;
      }
      return undefined;
    };

    const dateCol = findCol([
      'date',
      'transactiondate',
      'posteddate',
      'postingdate',
    ]);
    const descCol = findCol([
      'description',
      'merchant',
      'name',
      'payee',
      'memo',
      'narration',
    ]);
    const amountCol = findCol(['amount', 'debit', 'charge', 'value']);
    const currencyCol = findCol(['currency', 'cur']);

    if (!dateCol || !descCol || !amountCol) {
      throw new BadRequestException(
        'Bank CSV must include date, description/merchant, and amount columns.',
      );
    }

    const charges: ChargeRow[] = [];
    for (const row of rows) {
      const parsedDate = this.parseStatementDate(row[dateCol]);
      const rawDesc = (row[descCol] ?? '').trim();
      const rawAmount = Number((row[amountCol] ?? '').replace(/[^0-9.-]/g, ''));
      if (
        !parsedDate ||
        !rawDesc ||
        !Number.isFinite(rawAmount) ||
        rawAmount === 0
      ) {
        continue;
      }
      const absAmount = Math.abs(rawAmount);
      if (absAmount < 0.5 || absAmount > 5000) {
        continue;
      }
      const { key, display } = normalizeMerchant(rawDesc);
      if (!key) continue;
      charges.push({
        date: parsedDate,
        rawDescription: rawDesc,
        merchantKey: key,
        merchantDisplay: display,
        amount: Number(absAmount.toFixed(2)),
        currency: (
          (currencyCol ? row[currencyCol] : '')?.trim().slice(0, 3) ||
          defaultCurrency
        ).toUpperCase(),
      });
    }

    const groups = new Map<string, ChargeRow[]>();
    for (const charge of charges) {
      const bucket = groups.get(charge.merchantKey) ?? [];
      bucket.push(charge);
      groups.set(charge.merchantKey, bucket);
    }

    const catalog = await this.services.findAll();
    const candidates: Array<{
      service?: ServiceProvider;
      providerName: string;
      planName: string;
      amount: number;
      currency: string;
      interval: BillingInterval;
      nextRenewal: Date;
      confidence: number;
      evidence: string[];
    }> = [];

    for (const [, entries] of groups) {
      if (entries.length < 2) continue;
      const ordered = entries
        .slice()
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      const deltasDays: number[] = [];
      for (let i = 1; i < ordered.length; i += 1) {
        const diffDays =
          (ordered[i].date.getTime() - ordered[i - 1].date.getTime()) / DAY_MS;
        if (diffDays >= 4) {
          deltasDays.push(diffDays);
        }
      }
      if (deltasDays.length === 0) continue;

      const medianDays = median(deltasDays);
      const inferredInterval = classifyCadence(medianDays);
      if (!inferredInterval) continue;

      const latest = ordered[ordered.length - 1];
      const amounts = ordered.map((e) => e.amount);
      const minAmt = Math.min(...amounts);
      const maxAmt = Math.max(...amounts);
      const amountConsistent =
        maxAmt - minAmt <= Math.max(2, latest.amount * 0.15);
      if (!amountConsistent) continue;

      const service = this.matchCatalog(latest.merchantDisplay, catalog);
      const confidence = Math.min(
        92,
        65 + ordered.length * 6 + (service ? 10 : 0),
      );
      const nextRenewal = advanceRenewalDate(latest.date, inferredInterval);

      candidates.push({
        service,
        providerName: service?.name ?? latest.merchantDisplay,
        planName: `${service?.name ?? latest.merchantDisplay} Recurring Charge`,
        amount: latest.amount,
        currency: latest.currency,
        interval: inferredInterval,
        nextRenewal,
        confidence,
        evidence: ordered
          .slice(-3)
          .map(
            (e) =>
              `${e.date.toISOString().slice(0, 10)}: ${e.rawDescription} (${e.currency} ${e.amount.toFixed(2)})`,
          ),
      });
    }

    if (candidates.length === 0) {
      return {
        scannedRows: rows.length,
        detectedGroups: 0,
        items: [],
        message:
          'No recurring subscription charges were detected in this statement.',
      };
    }

    const bodyHash = createHash('sha256').update(rawCsv).digest('hex');
    const receipt = await this.prisma.emailReceipt.create({
      data: {
        source: 'bank_csv',
        externalMessageId: `bank_csv:${bodyHash}`,
        sender: 'local-statement@subsync.local',
        subject: `Bank CSV recurring scan (${candidates.length} detected)`,
        receivedAt: new Date(),
        parserId: 'bank_csv_detector',
        parserVersion: 1,
        status: 'review',
        overallConfidence: Math.round(
          candidates.reduce((s, c) => s + c.confidence, 0) / candidates.length,
        ),
        bodyHash,
      },
    });

    const createdItems: EmailReceiptItem[] = [];
    for (const candidate of candidates) {
      const row = await this.prisma.emailReceiptItem.create({
        data: {
          receiptId: receipt.id,
          serviceId: candidate.service?.id,
          providerName: candidate.providerName,
          planName: candidate.planName,
          amountCents: Math.round(candidate.amount * 100),
          currency: candidate.currency,
          interval: candidate.interval,
          renewalDate: candidate.nextRenewal,
          paymentSource: 'card',
          confidence: candidate.confidence,
          action: 'review',
          evidenceJson: JSON.stringify(candidate.evidence),
        },
      });
      createdItems.push({
        id: row.id,
        receiptId: receipt.id,
        serviceId: row.serviceId ?? undefined,
        providerName: row.providerName,
        planName: row.planName,
        billingAmount: row.amountCents / 100,
        billingCurrency: row.currency,
        billingInterval: candidate.interval,
        nextRenewal: row.renewalDate.toISOString(),
        paymentSource: 'card',
        confidence: row.confidence,
        action: 'review',
        evidence: candidate.evidence,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      });
    }

    return {
      scannedRows: rows.length,
      detectedGroups: createdItems.length,
      receiptId: receipt.id,
      items: createdItems,
      message: `Queued ${createdItems.length} recurring subscription candidate${createdItems.length === 1 ? '' : 's'} for review.`,
    };
  }

  private parseStatementDate(raw: string): Date | null {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const d = new Date(`${trimmed}T00:00:00.000Z`);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slash) {
      const month = Number(slash[1]);
      const day = Number(slash[2]);
      const year = Number(slash[3]);
      const d = new Date(Date.UTC(year, month - 1, day));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const fallback = new Date(trimmed);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  private matchCatalog(
    merchantDisplay: string,
    catalog: ServiceProvider[],
  ): ServiceProvider | undefined {
    const norm = merchantDisplay.toLowerCase().replace(/[^a-z0-9]/g, '');
    return catalog.find((s) => {
      const sNorm = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return norm.includes(sNorm) || sNorm.includes(norm);
    });
  }
}

export function normalizeMerchant(raw: string): {
  key: string;
  display: string;
} {
  const cleaned = raw
    .replace(
      /^(?:POS\s+DEBIT|ACH\s+DEBIT|RECURRING\s+PAYMENT|PAYPAL\s*\*|SQ\s*\*|STRIPE\s*\*|APLPAY|GOOGLE\s*\*)\s*/i,
      '',
    )
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, ' ')
    .replace(/[*#]\s*[A-Z0-9]{4,}/gi, ' ')
    .replace(/\b\d{4,}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const key = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 32);

  const display = cleaned
    .split(' ')
    .slice(0, 3)
    .map((word) =>
      word.length > 1
        ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        : word.toUpperCase(),
    )
    .join(' ');

  return { key, display: display || raw.slice(0, 32) };
}

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function classifyCadence(medianDays: number): BillingInterval | null {
  if (medianDays >= 6 && medianDays <= 8.5) return 'weekly';
  if (medianDays >= 26 && medianDays <= 35) return 'monthly';
  if (medianDays >= 83 && medianDays <= 98) return 'quarterly';
  if (medianDays >= 350 && medianDays <= 380) return 'yearly';
  return null;
}
