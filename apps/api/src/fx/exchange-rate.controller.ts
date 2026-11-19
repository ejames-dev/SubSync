import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ExchangeRateEntry } from '@subscription-tracker/types';
import { IsNumber, Min } from 'class-validator';
import { ExchangeRateService } from './exchange-rate.service';

class UpsertExchangeRateDto {
  @IsNumber()
  @Min(0.000001)
  rateToUsd!: number;
}

@Controller('exchange-rates')
export class ExchangeRateController {
  constructor(private readonly fxService: ExchangeRateService) {}

  @Get()
  listRates(): Promise<ExchangeRateEntry[]> {
    return this.fxService.listRates();
  }

  @Patch(':currency')
  upsertManualRate(
    @Param('currency') currency: string,
    @Body() dto: UpsertExchangeRateDto,
  ): Promise<ExchangeRateEntry> {
    return this.fxService.upsertManualRate(currency, dto.rateToUsd);
  }

  @Post('refresh')
  refresh(): Promise<ExchangeRateEntry[]> {
    return this.fxService.refreshFromPublicFeed();
  }
}
