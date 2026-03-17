import { Module } from '@nestjs/common';
import { EmailIngestController } from './email-ingest.controller';
import { EmailIngestService } from './email-ingest.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ServiceCatalogModule } from '../service-catalog/service-catalog.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [ServiceCatalogModule, SubscriptionsModule, IntegrationsModule],
  controllers: [EmailIngestController],
  providers: [EmailIngestService],
})
export class IngestModule {}
