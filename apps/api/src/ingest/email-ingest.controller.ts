import { Body, Controller, Post } from '@nestjs/common';

export class EmailIngestPayload {
  sender!: string;
  subject!: string;
  receivedAt!: string;
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
