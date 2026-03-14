import { Module } from '@nestjs/common';
import { ServiceCatalogModule } from './service-catalog/service-catalog.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { IngestModule } from './ingest/ingest.module';
import { PrismaModule } from './prisma/prisma.module';
import { NotificationPreferencesModule } from './notifications/notification-preferences.module';
import { ReminderModule } from './reminders/reminder.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    ServiceCatalogModule,
    SubscriptionsModule,
    IntegrationsModule,
    IngestModule,
    NotificationPreferencesModule,
    ReminderModule,
  ],
})
export class AppModule {}
