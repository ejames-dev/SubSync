import { Module } from '@nestjs/common';
import { ExchangeRateModule } from '../fx/exchange-rate.module';
import { ServiceCatalogModule } from '../service-catalog/service-catalog.module';
import { SettingsModule } from '../settings/settings.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    ServiceCatalogModule,
    SubscriptionsModule,
    SettingsModule,
    ExchangeRateModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
