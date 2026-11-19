import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ImapConnectionStatus,
  ImapSyncResult,
} from '@subscription-tracker/types';
import { TokenCryptoService } from '../gmail/token-crypto.service';
import { EmailIngestService } from '../ingest/email-ingest.service';
import { parseRawEml } from '../ingest/eml-parser.util';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectImapDto } from './dto/connect-imap.dto';
import { fetchRecentImapMessages } from './imap-client.util';

const BILLING_SUBJECT_HINT =
  /\b(?:receipt|invoice|payment|subscription|renewal|membership|billed|charge|trial|cancell?ed|order)\b/i;

@Injectable()
export class ImapService {
  private readonly logger = new Logger(ImapService.name);
  private syncInFlight = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenCrypto: TokenCryptoService,
    private readonly emailIngest: EmailIngestService,
  ) {}

  async getStatus(): Promise<ImapConnectionStatus> {
    const conn = await this.prisma.imapConnection.findUnique({
      where: { id: 'default' },
    });
    if (!conn) {
      return { connected: false };
    }
    return {
      connected: true,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      mailbox: conn.mailbox,
      tls: conn.tls,
      connectedAt: conn.connectedAt.toISOString(),
      lastSyncedAt: conn.lastSyncedAt?.toISOString(),
    };
  }

  async connect(dto: ConnectImapDto): Promise<ImapConnectionStatus> {
    const host = dto.host.trim();
    const port = dto.port ?? 993;
    const tls = dto.tls ?? true;
    const username = dto.username.trim();
    const mailbox = (dto.mailbox ?? 'INBOX').trim() || 'INBOX';

    if (!dto.skipVerify) {
      try {
        await fetchRecentImapMessages(
          {
            host,
            port,
            tls,
            username,
            password: dto.password,
            mailbox,
          },
          { verifyOnly: true },
        );
      } catch (err) {
        throw new BadRequestException(
          err instanceof Error
            ? `Could not connect to IMAP server: ${err.message}`
            : 'Could not connect to IMAP server.',
        );
      }
    }

    const passwordEnc = this.tokenCrypto.encrypt(dto.password);
    const saved = await this.prisma.imapConnection.upsert({
      where: { id: 'default' },
      update: {
        host,
        port,
        tls,
        username,
        passwordEnc,
        mailbox,
        connectedAt: new Date(),
      },
      create: {
        id: 'default',
        host,
        port,
        tls,
        username,
        passwordEnc,
        mailbox,
      },
    });

    return {
      connected: true,
      host: saved.host,
      port: saved.port,
      username: saved.username,
      mailbox: saved.mailbox,
      tls: saved.tls,
      connectedAt: saved.connectedAt.toISOString(),
      lastSyncedAt: saved.lastSyncedAt?.toISOString(),
    };
  }

  async disconnect(): Promise<ImapConnectionStatus> {
    await this.prisma.imapConnection
      .delete({ where: { id: 'default' } })
      .catch(() => undefined);
    return { connected: false };
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledSync(): Promise<void> {
    const status = await this.getStatus();
    if (!status.connected) return;
    try {
      const result = await this.syncBillingEmails();
      this.logger.log(
        `Scheduled IMAP sync complete: scanned=${result.scanned} imported=${result.imported} review=${result.review}`,
      );
    } catch (err) {
      this.logger.error(
        `Scheduled IMAP sync failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async syncBillingEmails(): Promise<ImapSyncResult> {
    if (this.syncInFlight) {
      throw new BadRequestException('An IMAP sync is already in progress.');
    }
    const conn = await this.prisma.imapConnection.findUnique({
      where: { id: 'default' },
    });
    if (!conn) {
      throw new BadRequestException('No IMAP mailbox is connected.');
    }

    this.syncInFlight = true;
    let scanned = 0;
    let imported = 0;
    let review = 0;
    let skipped = 0;
    let failed = 0;

    try {
      const password = this.tokenCrypto.decrypt(conn.passwordEnc);
      const messages = await fetchRecentImapMessages({
        host: conn.host,
        port: conn.port,
        tls: conn.tls,
        username: conn.username,
        password,
        mailbox: conn.mailbox,
      });

      for (const msg of messages) {
        scanned += 1;
        const parsed = parseRawEml(msg.rawEml);
        if (
          !BILLING_SUBJECT_HINT.test(
            `${parsed.subject}\n${parsed.body.slice(0, 800)}`,
          )
        ) {
          skipped += 1;
          continue;
        }
        const externalMessageId = parsed.messageId
          ? `imap:${parsed.messageId}`
          : `imap:${conn.host}:${conn.mailbox}:${msg.uid}`;

        const res = await this.emailIngest.ingest({
          sender: parsed.sender,
          subject: parsed.subject.slice(0, 255),
          receivedAt: parsed.receivedAt,
          body: parsed.body.slice(0, 50000),
          externalMessageId,
          source: 'imap',
          authenticatedSender: parsed.authenticatedSender,
        });

        if (res.status === 'created' || res.status === 'updated') {
          imported += 1;
        } else if (res.status === 'review' || res.status === 'mixed') {
          review += 1;
        } else if (res.status === 'duplicate' || res.status === 'ignored') {
          skipped += 1;
        } else {
          failed += 1;
        }
      }

      const syncedAt = new Date();
      await this.prisma.imapConnection.update({
        where: { id: 'default' },
        data: { lastSyncedAt: syncedAt },
      });

      return {
        scanned,
        imported,
        review,
        skipped,
        failed,
        syncedAt: syncedAt.toISOString(),
      };
    } finally {
      this.syncInFlight = false;
    }
  }
}
