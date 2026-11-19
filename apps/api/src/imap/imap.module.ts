import { Module } from '@nestjs/common';
import { GmailModule } from '../gmail/gmail.module';
import { IngestModule } from '../ingest/ingest.module';
import { ImapController } from './imap.controller';
import { ImapService } from './imap.service';

@Module({
  imports: [GmailModule, IngestModule],
  controllers: [ImapController],
  providers: [ImapService],
  exports: [ImapService],
})
export class ImapModule {}
