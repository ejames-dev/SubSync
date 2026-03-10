import { Module } from '@nestjs/common';
import { EmailIngestController } from './email-ingest.controller';

@Module({
  controllers: [EmailIngestController],
})
export class IngestModule {}
