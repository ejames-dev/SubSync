import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [SettingsModule],
  controllers: [NotificationPreferencesController, NotificationsController],
  providers: [NotificationPreferencesService, NotificationDeliveryService],
  exports: [NotificationPreferencesService, NotificationDeliveryService],
})
export class NotificationPreferencesModule {}
