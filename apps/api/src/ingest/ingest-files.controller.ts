import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  BankCsvIngestResult,
  EmailIngestResult,
} from '@subscription-tracker/types';
import { BankStatementIngestService } from './bank-statement-ingest.service';
import { EmailIngestService } from './email-ingest.service';
import { parseRawEml } from './eml-parser.util';

@Controller('ingest')
export class IngestFilesController {
  constructor(
    private readonly emailIngest: EmailIngestService,
    private readonly bankStatementIngest: BankStatementIngestService,
  ) {}

  @Post('eml')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async ingestEml(
    @UploadedFile()
    file: { buffer: Buffer; originalname?: string } | undefined,
    @Body() body: { content?: string },
  ): Promise<EmailIngestResult> {
    const raw = file?.buffer
      ? file.buffer.toString('utf8')
      : (body?.content ?? '');
    if (!raw.trim()) {
      throw new BadRequestException('Provide an .eml file or raw EML content.');
    }

    const parsed = parseRawEml(raw);
    return this.emailIngest.ingest({
      sender: parsed.sender,
      subject: parsed.subject.slice(0, 255),
      receivedAt: parsed.receivedAt,
      body: parsed.body.slice(0, 50000),
      externalMessageId: parsed.messageId
        ? `eml:${parsed.messageId}`
        : undefined,
      source: 'eml',
      authenticatedSender: parsed.authenticatedSender,
    });
  }

  @Post('bank-csv')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async ingestBankCsv(
    @UploadedFile()
    file: { buffer: Buffer; originalname?: string } | undefined,
    @Body() body: { content?: string; currency?: string },
  ): Promise<BankCsvIngestResult> {
    const raw = file?.buffer
      ? file.buffer.toString('utf8')
      : (body?.content ?? '');
    if (!raw.trim()) {
      throw new BadRequestException(
        'Provide a bank statement CSV file or CSV content.',
      );
    }

    return this.bankStatementIngest.analyzeCsv(raw, body?.currency || 'USD');
  }
}
