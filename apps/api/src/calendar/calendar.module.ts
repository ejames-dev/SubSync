import { Module } from '@nestjs/common';
import { ServiceCatalogModule } from '../service-catalog/service-catalog.module';
import { SettingsModule } from '../settings/settings.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  imports: [SubscriptionsModule, ServiceCatalogModule, SettingsModule],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
