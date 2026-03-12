import {
  IsNumber,
  IsOptional,
  IsString,
  IsISO8601,
  Min,
  IsIn,
} from 'class-validator';
import { BillingInterval, Subscription } from '@subscription-tracker/types';

export class CreateSubscriptionDto {
  @IsString()
  serviceId!: string;

  @IsString()
  planName!: string;

  @IsNumber()
  @Min(0)
  billingAmount!: number;

  @IsString()
  billingCurrency!: string;

  @IsIn(['monthly', 'yearly', 'quarterly', 'custom'])
  billingInterval!: BillingInterval;

  @IsISO8601()
  nextRenewal!: string;

  @IsOptional()
  @IsString()
  paymentSource?: 'card' | 'paypal' | 'gift' | 'other';

  @IsOptional()
  @IsString()
  paymentLast4?: string;

  @IsOptional()
  @IsIn(['active', 'trial', 'canceled_pending'])
  status?: Subscription['status'];

  @IsOptional()
  @IsString()
  notes?: string;
}
