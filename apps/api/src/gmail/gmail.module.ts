import { Module } from '@nestjs/common';
import { IngestModule } from '../ingest/ingest.module';
import { GmailController } from './gmail.controller';
import { GmailOAuthService } from './gmail-oauth.service';
import { GmailSyncService } from './gmail-sync.service';
import { TokenCryptoService } from './token-crypto.service';

@Module({
  imports: [IngestModule],
  controllers: [GmailController],
  providers: [TokenCryptoService, GmailOAuthService, GmailSyncService],
  exports: [GmailOAuthService, GmailSyncService],
})
export class GmailModule {}
