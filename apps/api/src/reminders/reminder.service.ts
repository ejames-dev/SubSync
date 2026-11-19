import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  advanceRenewalDate,
  normalizeBillingInterval,
  toMonthlyEquivalent,
} from '../common/billing-interval.util';
import { ExchangeRateService } from '../fx/exchange-rate.service';
import { NotificationDeliveryService } from '../notifications/notification-delivery.service';
import { NotificationPreferencesService } from '../notifications/notification-preferences.service';
import { OutboundAlertService } from '../notifications/outbound-alert.service';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationPreferences: NotificationPreferencesService,
    private readonly notificationDelivery: NotificationDeliveryService,
    @Optional() private readonly outboundAlerts?: OutboundAlertService,
    @Optional() private readonly exchangeRates?: ExchangeRateService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async dispatchRenewalReminders() {
    await this.rolloverElapsedRenewals();
    await this.queueDueRenewalReminders();
    await this.queueBudgetAlert();
  }

  async rolloverElapsedRenewals(now = new Date()): Promise<number> {
    const candidates = await this.prisma.subscription.findMany({
      where: {
        status: {
          in: [
            'active',
            'trial',
            'flagged_for_cancellation',
            'canceled_pending',
          ],
        },
        OR: [{ nextRenewal: { lte: now } }, { trialEndsAt: { lte: now } }],
      },
      include: { service: true },
    });

    if (!candidates.length) {
      return 0;
    }

    let rolledCount = 0;

    for (const subscription of candidates) {
      if (subscription.status === 'canceled_pending') {
        if (subscription.nextRenewal > now) {
          continue;
        }
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'canceled',
            statusChangedAt: now,
            nextRenewalReminderSent: false,
            snoozedUntil: null,
          },
        });
        await this.prisma.subscriptionEvent.create({
          data: {
            subscriptionId: subscription.id,
            eventType: 'status_changed',
            status: 'canceled',
            notes: 'Subscription ended after scheduled cancellation date.',
            occurredAt: subscription.nextRenewal,
          },
        });
        rolledCount += 1;
        continue;
      }

      if (subscription.status === 'trial') {
        const trialEnd = subscription.trialEndsAt ?? subscription.nextRenewal;
        if (trialEnd > now) {
          continue;
        }
        const interval = normalizeBillingInterval(subscription.billingInterval);
        const anchorDay = trialEnd.getUTCDate();
        let step = 1;
        let nextDate =
          advanceRenewalDate(
            trialEnd,
            interval,
            step,
            subscription.customIntervalDays,
            anchorDay,
          ) ?? new Date(trialEnd.getTime() + 30 * DAY_MS);
        while (nextDate <= now && step < 520) {
          step += 1;
          nextDate =
            advanceRenewalDate(
              trialEnd,
              interval,
              step,
              subscription.customIntervalDays,
              anchorDay,
            ) ?? new Date(nextDate.getTime() + 30 * DAY_MS);
        }

        const nextAmountCents =
          subscription.postTrialAmountCents ?? subscription.billingAmountCents;
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'active',
            statusChangedAt: now,
            billingAmountCents: nextAmountCents,
            trialEndsAt: null,
            nextRenewal: nextDate,
            nextRenewalReminderSent: false,
            snoozedUntil: null,
          },
        });
        await this.prisma.subscriptionEvent.create({
          data: {
            subscriptionId: subscription.id,
            eventType: 'status_changed',
            status: 'active',
            notes: 'Trial ended and converted to active subscription.',
            occurredAt: trialEnd,
          },
        });
        if (nextAmountCents !== subscription.billingAmountCents) {
          await this.prisma.subscriptionEvent.create({
            data: {
              subscriptionId: subscription.id,
              eventType: 'price_changed',
              status: 'active',
              notes: `Trial converted from ${subscription.billingCurrency} ${(subscription.billingAmountCents / 100).toFixed(2)} to ${subscription.billingCurrency} ${(nextAmountCents / 100).toFixed(2)}`,
              previousAmountCents: subscription.billingAmountCents,
              previousCurrency: subscription.billingCurrency,
              amountCents: nextAmountCents,
              currency: subscription.billingCurrency,
              occurredAt: trialEnd,
            },
          });
        }
        rolledCount += 1;
        continue;
      }

      if (subscription.nextRenewal > now) {
        continue;
      }

      const interval = normalizeBillingInterval(subscription.billingInterval);
      const anchorDay = subscription.nextRenewal.getUTCDate();
      let step = 0;
      let lastOccurred = subscription.nextRenewal;
      let nextDate = advanceRenewalDate(
        subscription.nextRenewal,
        interval,
        1,
        subscription.customIntervalDays,
        anchorDay,
      );
      if (!nextDate) {
        continue;
      }

      while (nextDate && nextDate <= now && step < 520) {
        lastOccurred = nextDate;
        step += 1;
        nextDate = advanceRenewalDate(
          subscription.nextRenewal,
          interval,
          step + 1,
          subscription.customIntervalDays,
          anchorDay,
        );
      }

      if (!nextDate) {
        continue;
      }

      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          nextRenewal: nextDate,
          nextRenewalReminderSent: false,
          snoozedUntil: null,
        },
      });
      await this.prisma.subscriptionEvent.create({
        data: {
          subscriptionId: subscription.id,
          eventType: 'renewal',
          status: subscription.status,
          notes: 'Automatic renewal rollover',
          amountCents: subscription.billingAmountCents,
          currency: subscription.billingCurrency,
          occurredAt: lastOccurred,
        },
      });
      rolledCount += 1;
    }

    if (rolledCount > 0) {
      this.logger.log(`Rolled forward ${rolledCount} elapsed subscriptions`);
    }
    return rolledCount;
  }

  async queueDueRenewalReminders(now = new Date()): Promise<number> {
    const preference = await this.notificationPreferences.getPreference();

    const candidateSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: { in: ['active', 'trial', 'flagged_for_cancellation'] },
        nextRenewalReminderSent: false,
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
      },
      include: { service: true },
    });

    const dueSubscriptions = candidateSubscriptions.filter((subscription) => {
      const leadDays =
        subscription.leadTimeDaysOverride ?? preference.leadTimeDays;
      const cutoff = new Date(now.getTime() + leadDays * DAY_MS);
      const targetDate =
        subscription.status === 'trial' && subscription.trialEndsAt
          ? subscription.trialEndsAt
          : subscription.nextRenewal;
      return targetDate <= cutoff;
    });

    if (!dueSubscriptions.length) {
      return 0;
    }

    for (const subscription of dueSubscriptions) {
      const targetDate =
        subscription.status === 'trial' && subscription.trialEndsAt
          ? subscription.trialEndsAt
          : subscription.nextRenewal;
      const amount = (subscription.billingAmountCents / 100).toFixed(2);
      const renewalDate = targetDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const serviceName = subscription.service.name;
      const isTrial = subscription.status === 'trial';
      const title = isTrial
        ? `${serviceName} trial ends soon`
        : `${serviceName} renews soon`;
      const body = isTrial
        ? subscription.postTrialAmountCents != null
          ? `${subscription.planName} trial ends on ${renewalDate} and converts to ${subscription.billingCurrency} ${(subscription.postTrialAmountCents / 100).toFixed(2)}.`
          : `${subscription.planName} trial ends on ${renewalDate} (${subscription.billingCurrency} ${amount}).`
        : `${subscription.planName} renews on ${renewalDate} for ${subscription.billingCurrency} ${amount}.`;

      for (const channel of preference.channels) {
        if (channel === 'push') {
          await this.notificationDelivery.queueRenewalReminder({
            subscriptionId: subscription.id,
            channel: 'push',
            title,
            body,
          });
        } else if (channel === 'email') {
          const sent = this.outboundAlerts
            ? await this.outboundAlerts.sendSmtpEmailIfConfigured({
                title,
                body,
                subscriptionId: subscription.id,
              })
            : false;
          if (!sent) {
            this.logger.log(
              `Email reminder recorded for ${subscription.planName} (${serviceName}) due on ${targetDate.toISOString()}`,
            );
          }
        }
      }
      if (this.outboundAlerts) {
        await this.outboundAlerts.sendWebhookIfConfigured({
          title,
          body,
          subscriptionId: subscription.id,
        });
      }
    }

    await this.prisma.subscription.updateMany({
      where: { id: { in: dueSubscriptions.map((sub) => sub.id) } },
      data: { nextRenewalReminderSent: true },
    });

    this.logger.log(
      `Queued renewal reminders for ${dueSubscriptions.length} subscriptions`,
    );
    return dueSubscriptions.length;
  }

  async queueBudgetAlert(): Promise<number> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { id: 'default' },
    });
    if (!settings?.monthlyBudgetCents) {
      return 0;
    }

    const currency = settings.budgetCurrency.toUpperCase();
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: { in: ['active', 'trial', 'flagged_for_cancellation'] },
      },
      select: {
        billingAmountCents: true,
        billingCurrency: true,
        billingInterval: true,
        customIntervalDays: true,
      },
    });
    const rateMap = this.exchangeRates
      ? await this.exchangeRates.getRateMap()
      : null;
    const monthlyEquivalentCents = Math.round(
      subscriptions.reduce((total, subscription) => {
        const subCur = subscription.billingCurrency.toUpperCase();
        let cents = subscription.billingAmountCents;
        if (subCur !== currency) {
          if (!rateMap || !this.exchangeRates) {
            return total;
          }
          const converted = this.exchangeRates.convert(
            cents,
            subCur,
            currency,
            rateMap,
          );
          if (converted === null) {
            return total;
          }
          cents = converted;
        }
        return (
          total +
          toMonthlyEquivalent(
            cents,
            normalizeBillingInterval(subscription.billingInterval),
            subscription.customIntervalDays,
          )
        );
      }, 0),
    );

    if (monthlyEquivalentCents < settings.monthlyBudgetCents) {
      if (settings.budgetAlertTriggered) {
        await this.prisma.userSettings.updateMany({
          where: { id: settings.id, budgetAlertTriggered: true },
          data: { budgetAlertTriggered: false },
        });
      }
      return 0;
    }

    const channels = this.parseChannels(settings.notificationChannels);
    if (!channels.length) {
      return 0;
    }

    const claimed = await this.prisma.userSettings.updateMany({
      where: {
        id: settings.id,
        budgetAlertTriggered: false,
        monthlyBudgetCents: settings.monthlyBudgetCents,
        budgetCurrency: settings.budgetCurrency,
      },
      data: { budgetAlertTriggered: true },
    });
    if (!claimed.count) {
      return 0;
    }

    const spend = this.formatMoney(monthlyEquivalentCents, currency);
    const threshold = this.formatMoney(settings.monthlyBudgetCents, currency);
    const title = 'Monthly budget reached';
    const body = `Your tracked monthly spend is ${spend}, at or above your ${threshold} budget.`;

    try {
      for (const channel of channels) {
        if (channel === 'push') {
          await this.notificationDelivery.queueNotification({
            channel,
            title,
            body,
          });
        } else {
          const sent = this.outboundAlerts
            ? await this.outboundAlerts.sendSmtpEmailIfConfigured({
                title,
                body,
              })
            : false;
          if (!sent) {
            this.logger.log(`Email budget alert recorded: ${body}`);
          }
        }
      }
      if (this.outboundAlerts) {
        await this.outboundAlerts.sendWebhookIfConfigured({ title, body });
      }
    } catch (error) {
      await this.prisma.userSettings.updateMany({
        where: { id: settings.id },
        data: { budgetAlertTriggered: false },
      });
      throw error;
    }

    this.logger.log(`Queued monthly budget alert for ${currency}`);
    return 1;
  }

  private parseChannels(value: string): Array<'email' | 'push'> {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (channel): channel is 'email' | 'push' =>
            channel === 'email' || channel === 'push',
        );
      }
    } catch {
      return [];
    }
    return [];
  }

  private formatMoney(amountCents: number, currency: string): string {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(amountCents / 100);
    } catch {
      return `${currency} ${(amountCents / 100).toFixed(2)}`;
    }
  }
}
