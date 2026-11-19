import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
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

  @IsOptional()
  @IsString()
  @MaxLength(500)
  webhookUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpHost?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpUsername?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  smtpPassword?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpFrom?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  syncFolderPath?: string | null;
}
