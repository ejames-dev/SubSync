import { ImapService } from './imap.service';
import { PrismaService } from '../prisma/prisma.service';
import { TokenCryptoService } from '../gmail/token-crypto.service';
import { EmailIngestService } from '../ingest/email-ingest.service';

describe('ImapService', () => {
  it('stores encrypted IMAP credentials when skipVerify is enabled and disconnects cleanly', async () => {
    const prisma = {
      imapConnection: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          id: 'default',
          host: 'imap.fastmail.com',
          port: 993,
          tls: true,
          username: 'user@fastmail.com',
          passwordEnc: 'enc_secret',
          mailbox: 'INBOX',
          connectedAt: new Date('2026-11-19T00:00:00.000Z'),
          lastSyncedAt: null,
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    const tokenCrypto = {
      encrypt: jest.fn().mockReturnValue('enc_secret'),
      decrypt: jest.fn().mockReturnValue('plain_secret'),
    };
    const emailIngest = { ingest: jest.fn() };

    const service = new ImapService(
      prisma as unknown as PrismaService,
      tokenCrypto as unknown as TokenCryptoService,
      emailIngest as unknown as EmailIngestService,
    );

    const status = await service.connect({
      host: 'imap.fastmail.com',
      port: 993,
      tls: true,
      username: 'user@fastmail.com',
      password: 'plain_secret',
      mailbox: 'INBOX',
      skipVerify: true,
    });

    expect(tokenCrypto.encrypt).toHaveBeenCalledWith('plain_secret');
    expect(status.connected).toBe(true);
    expect(status.host).toBe('imap.fastmail.com');

    const afterDisconnect = await service.disconnect();
    expect(afterDisconnect.connected).toBe(false);
  });
});
