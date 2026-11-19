import { Injectable } from '@nestjs/common';
import { BillingInterval } from '@subscription-tracker/types';
import { ServiceCatalogService } from '../service-catalog/service-catalog.service';
import { SettingsService } from '../settings/settings.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class CalendarService {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly services: ServiceCatalogService,
    private readonly settings: SettingsService,
  ) {}

  async generateIcsFeed(now = new Date()): Promise<string> {
    const [subs, catalog, userSettings] = await Promise.all([
      this.subscriptions.list(),
      this.services.findAll(),
      this.settings.getSettings(),
    ]);
    const serviceById = new Map(catalog.map((s) => [s.id, s]));
    const dtstamp = formatIcsUtcTimestamp(now);

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SubSync//Subscription Renewal Feed//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:SubSync Renewals',
    ];

    for (const sub of subs) {
      if (sub.status === 'paused' || sub.status === 'canceled') {
        continue;
      }
      const service = serviceById.get(sub.serviceId);
      const serviceName = service?.name ?? sub.serviceId;
      const targetIso =
        sub.status === 'trial' && sub.trialEndsAt
          ? sub.trialEndsAt
          : sub.nextRenewal;
      const startDate = new Date(targetIso);
      if (Number.isNaN(startDate.getTime())) continue;

      const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
      const summary =
        sub.status === 'trial'
          ? `${serviceName} trial ends (${sub.billingCurrency} ${(sub.postTrialAmount ?? sub.billingAmount).toFixed(2)})`
          : sub.status === 'canceled_pending'
            ? `${serviceName} subscription ends`
            : `${serviceName} renewal (${sub.billingCurrency} ${sub.billingAmount.toFixed(2)})`;

      const descriptionParts = [
        `Plan: ${sub.planName}`,
        `Amount: ${sub.billingCurrency} ${sub.billingAmount.toFixed(2)} (${sub.billingInterval})`,
      ];
      if (service?.cancelUrl) {
        descriptionParts.push(`Cancel guide: ${service.cancelUrl}`);
      }

      const rrule =
        sub.status === 'canceled_pending' || sub.status === 'trial'
          ? null
          : buildRrule(sub.billingInterval, sub.customIntervalDays);

      const leadDays =
        sub.leadTimeDaysOverride ??
        userSettings.notificationPreference.leadTimeDays;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:subsync-${sub.id}@subsync.local`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(startDate)}`);
      lines.push(`DTEND;VALUE=DATE:${formatIcsDate(endDate)}`);
      if (rrule) {
        lines.push(`RRULE:${rrule}`);
      }
      lines.push(`SUMMARY:${escapeIcsText(summary)}`);
      lines.push(`DESCRIPTION:${escapeIcsText(descriptionParts.join('\n'))}`);
      if (leadDays >= 0) {
        lines.push('BEGIN:VALARM');
        lines.push(`TRIGGER:-P${leadDays}D`);
        lines.push('ACTION:DISPLAY');
        lines.push(`DESCRIPTION:${escapeIcsText(summary)}`);
        lines.push('END:VALARM');
      }
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return `${lines.join('\r\n')}\r\n`;
  }
}

function buildRrule(
  interval: BillingInterval,
  customIntervalDays?: number,
): string | null {
  switch (interval) {
    case 'weekly':
      return 'FREQ=WEEKLY;INTERVAL=1';
    case 'monthly':
      return 'FREQ=MONTHLY;INTERVAL=1';
    case 'quarterly':
      return 'FREQ=MONTHLY;INTERVAL=3';
    case 'yearly':
      return 'FREQ=YEARLY;INTERVAL=1';
    case 'custom':
      return customIntervalDays && customIntervalDays > 0
        ? `FREQ=DAILY;INTERVAL=${customIntervalDays}`
        : null;
    default: {
      const exhaustiveCheck: never = interval;
      return exhaustiveCheck;
    }
  }
}

function formatIcsDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function formatIcsUtcTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}
