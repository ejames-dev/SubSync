import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationPreferencesService } from '../notifications/notification-preferences.service';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationPreferences: NotificationPreferencesService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async dispatchRenewalReminders() {
    const preference = await this.notificationPreferences.getPreference();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + preference.leadTimeDays);

    const dueSubscriptions = await this.prisma.subscription.findMany({
      where: {
        nextRenewalReminderSent: false,
        nextRenewal: { lte: cutoff },
      },
    });

    if (!dueSubscriptions.length) {
      return;
    }

    await this.prisma.subscription.updateMany({
      where: { id: { in: dueSubscriptions.map((sub) => sub.id) } },
      data: { nextRenewalReminderSent: true },
    });

    for (const sub of dueSubscriptions) {
      this.logger.log(
        `Reminder queued for ${sub.planName} (${sub.serviceId}) due on ${sub.nextRenewal.toISOString()}`,
      );
    }
  }
}
