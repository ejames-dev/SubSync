import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { YearlyReview } from '@subscription-tracker/types';
import { YearlyReviewService } from './yearly-review.service';

@Controller('insights')
export class InsightsController {
  constructor(private readonly yearlyReview: YearlyReviewService) {}

  @Get('yearly-review')
  getYearlyReview(@Query('year') year?: string): Promise<YearlyReview> {
    const selectedYear =
      year === undefined ? new Date().getUTCFullYear() : Number(year);
    if (
      !/^\d{4}$/.test(year ?? String(selectedYear)) ||
      selectedYear < 2000 ||
      selectedYear > 2100
    ) {
      throw new BadRequestException(
        'year must be a four-digit year between 2000 and 2100',
      );
    }

    return this.yearlyReview.getReview(selectedYear);
  }
}
