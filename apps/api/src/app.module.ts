import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SentryModule } from '@sentry/nestjs/setup';
import { ServiceCatalogModule } from './service-catalog/service-catalog.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { IngestModule } from './ingest/ingest.module';
import { PrismaModule } from './prisma/prisma.module';
import { NotificationPreferencesModule } from './notifications/notification-preferences.module';
import { ReminderModule } from './reminders/reminder.module';
import { SettingsModule } from './settings/settings.module';
import { CalendarModule } from './calendar/calendar.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DataModule } from './data/data.module';
import { ExchangeRateModule } from './fx/exchange-rate.module';
import { GmailModule } from './gmail/gmail.module';
import { ImapModule } from './imap/imap.module';
import { InsightsModule } from './insights/insights.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    ServiceCatalogModule,
    SubscriptionsModule,
    ExchangeRateModule,
    CalendarModule,
    DashboardModule,
    IntegrationsModule,
    IngestModule,
    GmailModule,
    ImapModule,
    InsightsModule,
    DataModule,
    NotificationPreferencesModule,
    ReminderModule,
    SettingsModule,
  ],
})
export class AppModule {}
