import { Module } from '@nestjs/common';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationPreferencesController } from './notification-preferences.controller';

@Module({
  controllers: [NotificationPreferencesController],
  providers: [NotificationPreferencesService],
  exports: [NotificationPreferencesService],
})
export class NotificationPreferencesModule {}
