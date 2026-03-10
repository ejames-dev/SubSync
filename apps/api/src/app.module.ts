import { Module } from '@nestjs/common';
import { ServiceCatalogModule } from './service-catalog/service-catalog.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { IngestModule } from './ingest/ingest.module';

@Module({
  imports: [
    ServiceCatalogModule,
    SubscriptionsModule,
    IntegrationsModule,
    IngestModule,
  ],
})
export class AppModule {}
