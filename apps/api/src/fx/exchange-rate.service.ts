import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExchangeRateEntry } from '@subscription-tracker/types';
import { PrismaService } from '../prisma/prisma.service';

// Offline baseline rates (USD per 1 unit of currency) used whenever a currency
// has not yet been refreshed online or manually overridden.
export const DEFAULT_RATES_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.72,
  AUD: 0.65,
  NZD: 0.6,
  CHF: 1.13,
  JPY: 0.0065,
  SEK: 0.095,
  NOK: 0.091,
  DKK: 0.145,
  INR: 0.012,
  BRL: 0.18,
  MXN: 0.05,
  SGD: 0.74,
  HKD: 0.128,
};

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listRates(): Promise<ExchangeRateEntry[]> {
    const stored = await this.prisma.exchangeRate.findMany({
      orderBy: { currency: 'asc' },
    });
    const byCurrency = new Map<string, ExchangeRateEntry>();
    const epochIso = new Date(0).toISOString();

    for (const [currency, rateToUsd] of Object.entries(DEFAULT_RATES_TO_USD)) {
      byCurrency.set(currency, {
        currency,
        rateToUsd,
        isManualOverride: false,
        updatedAt: epochIso,
      });
    }

    for (const row of stored) {
      byCurrency.set(row.currency.toUpperCase(), {
        currency: row.currency.toUpperCase(),
        rateToUsd: row.rateToUsd,
        isManualOverride: row.isManualOverride,
        updatedAt: row.updatedAt.toISOString(),
      });
    }

    return Array.from(byCurrency.values()).sort((a, b) =>
      a.currency.localeCompare(b.currency),
    );
  }

  async getRateMap(): Promise<Map<string, number>> {
    const entries = await this.listRates();
    const map = new Map<string, number>();
    for (const entry of entries) {
      if (entry.rateToUsd > 0 && Number.isFinite(entry.rateToUsd)) {
        map.set(entry.currency.toUpperCase(), entry.rateToUsd);
      }
    }
    map.set('USD', 1);
    return map;
  }

  convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    rateMap: Map<string, number>,
  ): number | null {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();
    if (from === to) {
      return amount;
    }
    const fromToUsd = rateMap.get(from);
    const targetToUsd = rateMap.get(to);
    if (!fromToUsd || !targetToUsd || targetToUsd <= 0) {
      return null;
    }
    return (amount * fromToUsd) / targetToUsd;
  }

  async upsertManualRate(
    currency: string,
    rateToUsd: number,
  ): Promise<ExchangeRateEntry> {
    const code = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      throw new BadRequestException('Currency must be a 3-letter ISO code.');
    }
    if (!Number.isFinite(rateToUsd) || rateToUsd <= 0) {
      throw new BadRequestException('Exchange rate must be greater than 0.');
    }
    if (code === 'USD') {
      throw new BadRequestException('USD base rate is fixed at 1.0.');
    }

    const saved = await this.prisma.exchangeRate.upsert({
      where: { currency: code },
      update: { rateToUsd, isManualOverride: true },
      create: { currency: code, rateToUsd, isManualOverride: true },
    });

    return {
      currency: saved.currency,
      rateToUsd: saved.rateToUsd,
      isManualOverride: saved.isManualOverride,
      updatedAt: saved.updatedAt.toISOString(),
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scheduledRefresh(): Promise<void> {
    if (process.env.SUBSYNC_DISABLE_FX_FETCH === 'true') {
      return;
    }
    await this.refreshFromPublicFeed().catch((err) => {
      this.logger.debug(
        `Offline FX cache retained (${err instanceof Error ? err.message : String(err)})`,
      );
    });
  }

  async refreshFromPublicFeed(): Promise<ExchangeRateEntry[]> {
    const url =
      process.env.FX_FEED_URL ?? 'https://open.er-api.com/v6/latest/USD';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, { signal: controller.signal }).finally(
        () => clearTimeout(timeout),
      );
      if (response.ok) {
        const payload = (await response.json()) as {
          rates?: Record<string, number>;
        };
        if (payload.rates && typeof payload.rates === 'object') {
          const existingManual = new Set(
            (
              await this.prisma.exchangeRate.findMany({
                where: { isManualOverride: true },
                select: { currency: true },
              })
            ).map((r) => r.currency.toUpperCase()),
          );

          for (const [cur, unitsPerUsd] of Object.entries(payload.rates)) {
            const code = cur.toUpperCase();
            if (
              !/^[A-Z]{3}$/.test(code) ||
              code === 'USD' ||
              existingManual.has(code) ||
              typeof unitsPerUsd !== 'number' ||
              unitsPerUsd <= 0
            ) {
              continue;
            }
            const rateToUsd = Number((1 / unitsPerUsd).toFixed(6));
            if (rateToUsd > 0) {
              await this.prisma.exchangeRate.upsert({
                where: { currency: code },
                update: { rateToUsd, isManualOverride: false },
                create: { currency: code, rateToUsd, isManualOverride: false },
              });
            }
          }
        }
      }
    } catch {
      // Offline-resilient: retain cached and baseline rates when offline.
    }

    return this.listRates();
  }
}
