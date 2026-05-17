import {
  IsNumber,
  IsOptional,
  IsString,
  IsISO8601,
  Min,
  IsIn,
  MaxLength,
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

  @IsIn(['monthly', 'yearly', 'quarterly', 'custom'])
  billingInterval!: BillingInterval;

  @IsISO8601()
  nextRenewal!: string;

  @IsOptional()
  @IsIn(['card', 'paypal', 'gift', 'other'])
  paymentSource?: 'card' | 'paypal' | 'gift' | 'other';

  @IsOptional()
  @IsString()
  @MaxLength(4)
  paymentLast4?: string;

  @IsOptional()
  @IsIn(['active', 'trial', 'canceled_pending'])
  status?: Subscription['status'];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
