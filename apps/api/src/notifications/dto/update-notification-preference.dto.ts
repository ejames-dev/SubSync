import { IsArray, IsIn, IsInt, Max, Min } from 'class-validator';

export class UpdateNotificationPreferenceDto {
  @IsInt()
  @Min(0)
  @Max(365)
  leadTimeDays!: number;

  @IsArray()
  @IsIn(['email', 'push'], { each: true })
  channels!: Array<'email' | 'push'>;
}
