import { ServiceUnavailableException } from '@nestjs/common';
import { GmailOAuthService } from './gmail-oauth.service';
import { TokenCryptoService } from './token-crypto.service';

describe('GmailOAuthService', () => {
  const prisma = {
    gmailConnection: {
      findUnique: jest.fn(),
    },
    oAuthState: {
      create: jest.fn(),
    },
  };

  beforeEach(() => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    jest.clearAllMocks();
  });

  it('reports unconfigured status when OAuth env vars are missing', async () => {
    const service = new GmailOAuthService(
      prisma as never,
      new TokenCryptoService(),
    );

    await expect(service.getStatus()).resolves.toEqual({
      connected: false,
      configured: false,
    });
  });

  it('requires OAuth credentials before creating an auth URL', async () => {
    const service = new GmailOAuthService(
      prisma as never,
      new TokenCryptoService(),
    );

    await expect(service.createAuthUrl()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
