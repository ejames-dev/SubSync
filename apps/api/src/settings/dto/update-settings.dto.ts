import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { NotificationPreference } from '@subscription-tracker/types';

export class UpdateSettingsDto {
  @IsInt()
  @Min(0)
  @Max(365)
  leadTimeDays!: number;

  @IsArray()
  @IsIn(['email', 'push'], { each: true })
  channels!: NotificationPreference['channels'];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  monthlyBudgetCents?: number | null;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  budgetCurrency?: string;
}
