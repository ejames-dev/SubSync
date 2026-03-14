import { ArrayNotEmpty, IsArray, IsIn, IsInt, Max, Min } from 'class-validator';

export class UpdateNotificationPreferenceDto {
  @IsInt()
  @Min(1)
  @Max(30)
  leadTimeDays!: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(['email', 'push'], { each: true })
  channels!: Array<'email' | 'push'>;
}
