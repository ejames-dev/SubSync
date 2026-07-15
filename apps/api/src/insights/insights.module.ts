import { Module } from '@nestjs/common';
import { InsightsController } from './insights.controller';
import { YearlyReviewService } from './yearly-review.service';

@Module({
  controllers: [InsightsController],
  providers: [YearlyReviewService],
})
export class InsightsModule {}
