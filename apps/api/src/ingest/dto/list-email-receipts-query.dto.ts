import { IsIn, IsOptional } from 'class-validator';
import { EmailReceiptStatus } from '@subscription-tracker/types';

export class ListEmailReceiptsQueryDto {
  @IsOptional()
  @IsIn(['processing', 'imported', 'review', 'failed', 'rejected'])
  status?: EmailReceiptStatus;
}
