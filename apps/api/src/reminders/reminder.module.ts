import { Module } from '@nestjs/common';
import { ExchangeRateModule } from '../fx/exchange-rate.module';
import { NotificationPreferencesModule } from '../notifications/notification-preferences.module';
import { ReminderService } from './reminder.service';

@Module({
  imports: [NotificationPreferencesModule, ExchangeRateModule],
  providers: [ReminderService],
  exports: [ReminderService],
})
export class ReminderModule {}
