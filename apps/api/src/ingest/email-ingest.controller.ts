import { Body, Controller, Post } from '@nestjs/common';
import { EmailIngestResult } from '@subscription-tracker/types';
import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EmailIngestService } from './email-ingest.service';

export class EmailIngestPayload {
  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  sender!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject!: string;

  @IsISO8601()
  receivedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  body?: string;
}

@Controller('ingest/email')
export class EmailIngestController {
  constructor(private readonly ingestService: EmailIngestService) {}

  @Post()
  ingest(@Body() payload: EmailIngestPayload): Promise<EmailIngestResult> {
    return this.ingestService.ingest(payload);
  }
}
