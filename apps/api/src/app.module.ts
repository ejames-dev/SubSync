import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ServiceCatalogModule } from './service-catalog/service-catalog.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { IngestModule } from './ingest/ingest.module';
import { PrismaModule } from './prisma/prisma.module';
import { NotificationPreferencesModule } from './notifications/notification-preferences.module';
import { ReminderModule } from './reminders/reminder.module';
import { SettingsModule } from './settings/settings.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    ServiceCatalogModule,
    SubscriptionsModule,
    DashboardModule,
    IntegrationsModule,
    IngestModule,
    NotificationPreferencesModule,
    ReminderModule,
    SettingsModule,
  ],
})
export class AppModule {}
