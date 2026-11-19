import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BillingInterval, Subscription } from '@subscription-tracker/types';

export class CreateSubscriptionDto {
  @IsString()
  @MaxLength(100)
  serviceId!: string;

  @IsString()
  @MaxLength(150)
  planName!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  billingAmount!: number;

  @IsString()
  @MaxLength(3)
  billingCurrency!: string;

  @IsIn(['weekly', 'monthly', 'yearly', 'quarterly', 'custom'])
  billingInterval!: BillingInterval;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  customIntervalDays?: number | null;

  @IsISO8601()
  nextRenewal!: string;

  @IsOptional()
  @IsISO8601()
  trialEndsAt?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  postTrialAmount?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  leadTimeDaysOverride?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(['card', 'paypal', 'gift', 'other'])
  paymentSource?: 'card' | 'paypal' | 'gift' | 'other';

  @IsOptional()
  @IsString()
  @MaxLength(4)
  paymentLast4?: string;

  @IsOptional()
  @IsIn([
    'active',
    'trial',
    'paused',
    'flagged_for_cancellation',
    'canceled_pending',
    'canceled',
  ])
  status?: Subscription['status'];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
