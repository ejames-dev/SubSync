import { Injectable } from '@nestjs/common';
import { SubscriptionExportPayload } from '@subscription-tracker/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DataExportService {
  constructor(private readonly prisma: PrismaService) {}

  async buildSubscriptionExport(): Promise<SubscriptionExportPayload> {
    const records = await this.prisma.subscription.findMany({
      include: { service: true },
      orderBy: { nextRenewal: 'asc' },
    });

    return {
      exportedAt: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.1.0',
      subscriptions: records.map((record) => ({
        id: record.id,
        serviceId: record.serviceId,
        serviceName: record.service.name,
        planName: record.planName,
        status: record.status,
        billingAmount: record.billingAmountCents / 100,
        billingCurrency: record.billingCurrency,
        billingInterval: record.billingInterval,
        nextRenewal: record.nextRenewal.toISOString(),
        paymentSource: record.paymentSource ?? undefined,
        paymentLast4: record.paymentLast4 ?? undefined,
        autoImportSource: record.autoImportSource ?? undefined,
        notes: record.notes ?? undefined,
        statusChangedAt: record.statusChangedAt.toISOString(),
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      })),
    };
  }

  async exportSubscriptionsJson(): Promise<string> {
    const payload = await this.buildSubscriptionExport();
    return JSON.stringify(payload, null, 2);
  }

  async exportSubscriptionsCsv(): Promise<string> {
    const payload = await this.buildSubscriptionExport();
    const headers = [
      'id',
      'serviceId',
      'serviceName',
      'planName',
      'status',
      'billingAmount',
      'billingCurrency',
      'billingInterval',
      'nextRenewal',
      'paymentSource',
      'paymentLast4',
      'autoImportSource',
      'notes',
      'statusChangedAt',
      'createdAt',
      'updatedAt',
    ];

    const rows = payload.subscriptions.map((subscription) =>
      [
        subscription.id,
        subscription.serviceId,
        subscription.serviceName,
        subscription.planName,
        subscription.status,
        String(subscription.billingAmount),
        subscription.billingCurrency,
        subscription.billingInterval,
        subscription.nextRenewal,
        subscription.paymentSource ?? '',
        subscription.paymentLast4 ?? '',
        subscription.autoImportSource ?? '',
        subscription.notes ?? '',
        subscription.statusChangedAt,
        subscription.createdAt,
        subscription.updatedAt,
      ]
        .map((value) => escapeCsv(String(value)))
        .join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
