import { Module } from '@nestjs/common';
import { ExchangeRateModule } from '../fx/exchange-rate.module';
import { SettingsModule } from '../settings/settings.module';
import { InsightsController } from './insights.controller';
import { YearlyReviewService } from './yearly-review.service';

@Module({
  imports: [ExchangeRateModule, SettingsModule],
  controllers: [InsightsController],
  providers: [YearlyReviewService],
})
export class InsightsModule {}
