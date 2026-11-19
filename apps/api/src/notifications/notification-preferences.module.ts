import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationsController } from './notifications.controller';
import { OutboundAlertService } from './outbound-alert.service';

@Module({
  imports: [SettingsModule],
  controllers: [NotificationPreferencesController, NotificationsController],
  providers: [
    NotificationPreferencesService,
    NotificationDeliveryService,
    OutboundAlertService,
  ],
  exports: [
    NotificationPreferencesService,
    NotificationDeliveryService,
    OutboundAlertService,
  ],
})
export class NotificationPreferencesModule {}
