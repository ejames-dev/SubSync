import { Module } from '@nestjs/common';
import { EmailIngestController } from './email-ingest.controller';
import { EmailIngestService } from './email-ingest.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ServiceCatalogModule } from '../service-catalog/service-catalog.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationPreferencesModule } from '../notifications/notification-preferences.module';
import { EmailReceiptsController } from './email-receipts.controller';
import { EmailReceiptsService } from './email-receipts.service';

@Module({
  imports: [
    ServiceCatalogModule,
    SubscriptionsModule,
    IntegrationsModule,
    NotificationPreferencesModule,
  ],
  controllers: [EmailIngestController, EmailReceiptsController],
  providers: [EmailIngestService, EmailReceiptsService],
  exports: [EmailIngestService],
})
export class IngestModule {}
