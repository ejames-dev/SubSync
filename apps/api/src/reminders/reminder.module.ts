import { Module } from '@nestjs/common';
import { ReminderService } from './reminder.service';
import { NotificationPreferencesModule } from '../notifications/notification-preferences.module';

@Module({
  imports: [NotificationPreferencesModule],
  providers: [ReminderService],
  exports: [ReminderService],
})
export class ReminderModule {}
