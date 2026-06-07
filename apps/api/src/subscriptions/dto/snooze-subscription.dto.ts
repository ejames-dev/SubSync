import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SnoozeSubscriptionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number;
}
