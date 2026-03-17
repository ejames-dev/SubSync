import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ServiceCatalogModule } from '../service-catalog/service-catalog.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [ServiceCatalogModule, SubscriptionsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
