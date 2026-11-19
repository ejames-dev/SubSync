import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { NotificationPreferencesModule } from '../notifications/notification-preferences.module';
import { ServiceCatalogModule } from '../service-catalog/service-catalog.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { BankStatementIngestService } from './bank-statement-ingest.service';
import { EmailIngestController } from './email-ingest.controller';
import { EmailIngestService } from './email-ingest.service';
import { EmailReceiptsController } from './email-receipts.controller';
import { EmailReceiptsService } from './email-receipts.service';
import { IngestFilesController } from './ingest-files.controller';

@Module({
  imports: [
    ServiceCatalogModule,
    SubscriptionsModule,
    IntegrationsModule,
    NotificationPreferencesModule,
  ],
  controllers: [
    EmailIngestController,
    EmailReceiptsController,
    IngestFilesController,
  ],
  providers: [
    EmailIngestService,
    EmailReceiptsService,
    BankStatementIngestService,
  ],
  exports: [EmailIngestService, BankStatementIngestService],
})
export class IngestModule {}
