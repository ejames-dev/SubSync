import { Body, Controller, Post } from '@nestjs/common';
import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

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
  body?: string;
}

@Controller('ingest/email')
export class EmailIngestController {
  @Post()
  ingest(@Body() payload: EmailIngestPayload) {
    return {
      status: 'queued',
      inferredProvider: this.detectProvider(payload.subject),
      receivedAt: payload.receivedAt,
    };
  }

  private detectProvider(subject: string) {
    if (!subject) return 'unknown';
    const normalized = subject.toLowerCase();
    if (normalized.includes('netflix')) return 'Netflix';
    if (normalized.includes('disney')) return 'Disney+';
    if (normalized.includes('hulu')) return 'Hulu';
    return 'unknown';
  }
}
