import { Module } from '@nestjs/common';
import { ReminderService } from './reminder.service';
import { NotificationPreferencesModule } from '../notifications/notification-preferences.module';

@Module({
  imports: [NotificationPreferencesModule],
  providers: [ReminderService],
})
export class ReminderModule {}
