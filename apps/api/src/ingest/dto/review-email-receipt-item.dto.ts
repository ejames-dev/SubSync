import {
  IsISO8601,
  IsIn,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BillingInterval } from '@subscription-tracker/types';

export class ReviewEmailReceiptItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  serviceId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  planName?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000000)
  billingAmount?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  billingCurrency?: string;

  @IsOptional()
  @IsIn(['monthly', 'yearly', 'quarterly', 'custom'])
  billingInterval?: BillingInterval;

  @IsOptional()
  @IsISO8601()
  nextRenewal?: string;
}
