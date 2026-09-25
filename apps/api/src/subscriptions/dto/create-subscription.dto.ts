import {
  IsNumber,
  IsOptional,
  IsString,
  IsISO8601,
  Min,
  IsIn,
  MaxLength,
  ValidateIf,
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
  @IsIn(['active', 'trial', 'flagged_for_cancellation', 'canceled_pending'])
  status?: Subscription['status'];

  @ValidateIf(
    (dto: CreateSubscriptionDto) =>
      dto.status === 'trial' || dto.trialEndsAt !== undefined,
  )
  @IsISO8601(
    {},
    { message: 'trialEndsAt must be an ISO 8601 date for trial subscriptions' },
  )
  trialEndsAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
