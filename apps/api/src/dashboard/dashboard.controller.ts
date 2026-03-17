import { Controller, Get } from '@nestjs/common';
import { DashboardSummary } from '@subscription-tracker/types';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  async summary(): Promise<DashboardSummary> {
    return this.dashboard.getSummary();
  }
}
