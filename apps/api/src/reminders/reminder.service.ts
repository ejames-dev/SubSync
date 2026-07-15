import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationDeliveryService } from '../notifications/notification-delivery.service';
import { NotificationPreferencesService } from '../notifications/notification-preferences.service';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationPreferences: NotificationPreferencesService,
    private readonly notificationDelivery: NotificationDeliveryService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async dispatchRenewalReminders() {
    await this.queueDueRenewalReminders();
    await this.queueBudgetAlert();
  }

  async queueDueRenewalReminders(): Promise<number> {
    const preference = await this.notificationPreferences.getPreference();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + preference.leadTimeDays);

    const dueSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: { in: ['active', 'trial', 'flagged_for_cancellation'] },
        nextRenewalReminderSent: false,
        nextRenewal: { lte: cutoff },
      },
      include: { service: true },
    });

    if (!dueSubscriptions.length) {
      return 0;
    }

    for (const subscription of dueSubscriptions) {
      const amount = (subscription.billingAmountCents / 100).toFixed(2);
      const renewalDate = subscription.nextRenewal.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const serviceName = subscription.service.name;
      const title = `${serviceName} renews soon`;
      const body = `${subscription.planName} renews on ${renewalDate} for ${subscription.billingCurrency} ${amount}.`;

      for (const channel of preference.channels) {
        if (channel === 'push') {
          await this.notificationDelivery.queueRenewalReminder({
            subscriptionId: subscription.id,
            channel: 'push',
            title,
            body,
          });
        } else if (channel === 'email') {
          this.logger.log(
            `Email reminder recorded for ${subscription.planName} (${serviceName}) due on ${subscription.nextRenewal.toISOString()}`,
          );
        }
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
      },
    });
    const monthlyEquivalentCents = Math.round(
      subscriptions
        .filter(
          (subscription) =>
            subscription.billingCurrency.toUpperCase() === currency,
        )
        .reduce(
          (total, subscription) =>
            total +
            this.toMonthlyEquivalentCents(
              subscription.billingAmountCents,
              subscription.billingInterval,
            ),
          0,
        ),
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
          this.logger.log(`Email budget alert recorded: ${body}`);
        }
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

  private toMonthlyEquivalentCents(
    amountCents: number,
    interval: string,
  ): number {
    switch (interval) {
      case 'yearly':
        return amountCents / 12;
      case 'quarterly':
        return amountCents / 3;
      case 'monthly':
      case 'custom':
      default:
        return amountCents;
    }
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
