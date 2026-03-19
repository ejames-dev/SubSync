import { IsArray, IsIn, IsInt, Max, Min } from 'class-validator';
import { NotificationPreference } from '@subscription-tracker/types';

export class UpdateSettingsDto {
  @IsInt()
  @Min(0)
  @Max(365)
  leadTimeDays!: number;

  @IsArray()
  @IsIn(['email', 'push'], { each: true })
  channels!: NotificationPreference['channels'];
}
