import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailIngestResult, GmailSyncResult } from '@subscription-tracker/types';
import { EmailIngestService } from '../ingest/email-ingest.service';
import { PrismaService } from '../prisma/prisma.service';
import { GmailOAuthService } from './gmail-oauth.service';
import {
  extractHeader,
  extractPlainTextBody,
  getBillingSearchQuery,
  GmailApiMessage,
} from './gmail-message.util';

type GmailListResponse = {
  messages?: Array<{ id?: string }>;
  nextPageToken?: string;
};

@Injectable()
export class GmailSyncService {
  private readonly logger = new Logger(GmailSyncService.name);
  private syncInFlight = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gmailOAuth: GmailOAuthService,
    private readonly emailIngest: EmailIngestService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledSync(): Promise<void> {
    const status = await this.gmailOAuth.getStatus();
    if (!status.connected) {
      return;
    }

    try {
      const result = await this.syncBillingEmails();
      this.logger.log(
        `Scheduled Gmail sync complete: scanned=${result.scanned} imported=${result.imported} skipped=${result.skipped} failed=${result.failed}`,
      );
    } catch (error) {
      this.logger.error(
        `Scheduled Gmail sync failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async syncBillingEmails(): Promise<GmailSyncResult> {
    if (this.syncInFlight) {
      throw new Error('A Gmail sync is already in progress.');
    }

    this.syncInFlight = true;
    const results: EmailIngestResult[] = [];
    let scanned = 0;
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    try {
      const accessToken = await this.gmailOAuth.getValidAccessToken();
      const messageIds = await this.listBillingMessageIds(accessToken);

      for (const messageId of messageIds) {
        scanned += 1;
        const alreadyProcessed = await this.prisma.processedGmailMessage.findUnique({
          where: { messageId },
        });
        if (alreadyProcessed) {
          skipped += 1;
          continue;
        }

        try {
          const message = await this.fetchMessage(accessToken, messageId);
          const sender =
            extractHeader(message, 'From') ??
            extractHeader(message, 'Reply-To') ??
            'unknown@unknown';
          const subject = extractHeader(message, 'Subject') ?? '(no subject)';
          const receivedAt = message.internalDate
            ? new Date(Number(message.internalDate)).toISOString()
            : new Date().toISOString();
          const body = extractPlainTextBody(message);

          const result = await this.emailIngest.ingest({
            sender,
            subject,
            receivedAt,
            body,
          });

          await this.prisma.processedGmailMessage.create({
            data: { messageId },
          });

          results.push(result);
          imported += 1;
        } catch (error) {
          failed += 1;
          this.logger.warn(
            `Skipped Gmail message ${messageId}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }

      await this.prisma.gmailConnection.update({
        where: { id: 'default' },
        data: { lastSyncedAt: new Date() },
      });

      return {
        scanned,
        imported,
        skipped,
        failed,
        results,
        syncedAt: new Date().toISOString(),
      };
    } finally {
      this.syncInFlight = false;
    }
  }

  private async listBillingMessageIds(accessToken: string): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        q: getBillingSearchQuery(),
        maxResults: '25',
      });
      if (pageToken) {
        params.set('pageToken', pageToken);
      }

      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Gmail list failed (${response.status}): ${body}`);
      }

      const payload = (await response.json()) as GmailListResponse;
      for (const message of payload.messages ?? []) {
        if (message.id) {
          ids.push(message.id);
        }
      }
      pageToken = payload.nextPageToken;
    } while (pageToken);

    return ids;
  }

  private async fetchMessage(
    accessToken: string,
    messageId: string,
  ): Promise<GmailApiMessage> {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gmail message fetch failed (${response.status}): ${body}`);
    }

    return (await response.json()) as GmailApiMessage;
  }
}
