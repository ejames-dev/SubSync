import * as net from 'node:net';
import * as tls from 'node:tls';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { TokenCryptoService } from '../gmail/token-crypto.service';
import { PrismaService } from '../prisma/prisma.service';

export interface OutboundAlertMessage {
  title: string;
  body: string;
  subscriptionId?: string;
}

@Injectable()
export class OutboundAlertService {
  private readonly logger = new Logger(OutboundAlertService.name);
  private readonly tokenCrypto: TokenCryptoService;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() tokenCrypto?: TokenCryptoService,
  ) {
    this.tokenCrypto = tokenCrypto ?? new TokenCryptoService();
  }

  async sendWebhookIfConfigured(
    message: OutboundAlertMessage,
  ): Promise<boolean> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { id: 'default' },
    });
    const webhookUrl = settings?.webhookUrl?.trim();
    if (!webhookUrl) {
      return false;
    }

    const payload = buildWebhookPayload(webhookUrl, message);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Title: message.title,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!resp.ok) {
        this.logger.warn(
          `Webhook alert returned HTTP ${resp.status} for ${webhookUrl}`,
        );
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(
        `Webhook alert failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async sendSmtpEmailIfConfigured(
    message: OutboundAlertMessage,
  ): Promise<boolean> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { id: 'default' },
    });
    if (!settings?.smtpHost?.trim() || !settings?.smtpTo?.trim()) {
      return false;
    }

    const host = settings.smtpHost.trim();
    const port = settings.smtpPort ?? 465;
    const from = (
      settings.smtpFrom ??
      settings.smtpUsername ??
      'subsync@localhost'
    ).trim();
    const to = settings.smtpTo.trim();
    const username = settings.smtpUsername?.trim();
    const password = settings.smtpPasswordEnc
      ? this.tokenCrypto.decrypt(settings.smtpPasswordEnc)
      : undefined;

    try {
      await transmitSmtp({
        host,
        port,
        username,
        password,
        from,
        to,
        subject: message.title,
        body: message.body,
      });
      return true;
    } catch (err) {
      this.logger.warn(
        `SMTP alert delivery failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }
}

export function buildWebhookPayload(
  webhookUrl: string,
  message: OutboundAlertMessage,
): Record<string, unknown> {
  if (/discord\.com\/api\/webhooks/i.test(webhookUrl)) {
    return { content: `**${message.title}**\n${message.body}` };
  }
  if (/hooks\.slack\.com/i.test(webhookUrl)) {
    return { text: `*${message.title}*\n${message.body}` };
  }
  return {
    title: message.title,
    message: message.body,
    body: message.body,
    subscriptionId: message.subscriptionId,
    occurredAt: new Date().toISOString(),
  };
}

async function transmitSmtp(params: {
  host: string;
  port: number;
  username?: string;
  password?: string;
  from: string;
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  const implicitTls = params.port === 465;
  const socket: net.Socket = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('SMTP connection timed out.')),
      10_000,
    );
    const conn = implicitTls
      ? tls.connect(
          { host: params.host, port: params.port, servername: params.host },
          () => {
            clearTimeout(timer);
            resolve(conn);
          },
        )
      : net.createConnection({ host: params.host, port: params.port }, () => {
          clearTimeout(timer);
          resolve(conn);
        });
    conn.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  const readReply = (): Promise<string> =>
    new Promise((resolve, reject) => {
      let buf = '';
      const timer = setTimeout(() => {
        socket.off('data', onData);
        reject(new Error('SMTP response timed out.'));
      }, 10_000);
      const onData = (chunk: Buffer) => {
        buf += chunk.toString('utf8');
        const lines = buf.split(/\r?\n/).filter(Boolean);
        const last = lines[lines.length - 1];
        if (last && /^\d{3} /.test(last)) {
          clearTimeout(timer);
          socket.off('data', onData);
          if (/^[45]/.test(last)) {
            reject(new Error(`SMTP error: ${last}`));
          } else {
            resolve(buf);
          }
        }
      };
      socket.on('data', onData);
    });

  const sendLine = async (line: string) => {
    socket.write(`${line}\r\n`);
    return readReply();
  };

  try {
    await readReply();
    await sendLine(`EHLO subsync.local`);
    if (params.username && params.password) {
      const authToken = Buffer.from(
        `\u0000${params.username}\u0000${params.password}`,
        'utf8',
      ).toString('base64');
      await sendLine(`AUTH PLAIN ${authToken}`);
    }
    await sendLine(`MAIL FROM:<${params.from.replace(/[<>]/g, '')}>`);
    await sendLine(`RCPT TO:<${params.to.replace(/[<>]/g, '')}>`);
    socket.write('DATA\r\n');
    await readReply();

    const rfcMessage = [
      `From: ${params.from}`,
      `To: ${params.to}`,
      `Subject: ${params.subject.replace(/[\r\n]/g, ' ')}`,
      `Date: ${new Date().toUTCString()}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      params.body.replace(/^\./gm, '..'),
      '.',
    ].join('\r\n');
    await sendLine(rfcMessage);
    await sendLine('QUIT').catch(() => undefined);
  } finally {
    socket.destroy();
  }
}
