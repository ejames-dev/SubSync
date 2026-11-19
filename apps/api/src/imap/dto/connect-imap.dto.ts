import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ConnectImapDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  host!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsBoolean()
  tls?: boolean;

  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mailbox?: string;

  @IsOptional()
  @IsBoolean()
  skipVerify?: boolean;
}
