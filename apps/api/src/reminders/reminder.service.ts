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
  }

  async queueDueRenewalReminders(): Promise<number> {
    const preference = await this.notificationPreferences.getPreference();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + preference.leadTimeDays);

    const dueSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: { in: ['active', 'trial'] },
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
}
