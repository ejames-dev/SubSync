import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { BulkSubscriptionAction } from '@subscription-tracker/types';

export class BulkSubscriptionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids!: string[];

  @IsIn(['pause', 'activate', 'flag_cancel', 'archive', 'snooze', 'delete'])
  action!: BulkSubscriptionAction;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  snoozeDays?: number;
}
