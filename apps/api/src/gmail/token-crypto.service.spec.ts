import { TokenCryptoService } from './token-crypto.service';

describe('TokenCryptoService', () => {
  const previousKey = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  });

  afterEach(() => {
    if (previousKey === undefined) {
      delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.OAUTH_TOKEN_ENCRYPTION_KEY = previousKey;
    }
  });

  it('encrypts and decrypts token values', () => {
    const service = new TokenCryptoService();
    const encrypted = service.encrypt('refresh-token-value');
    expect(encrypted).not.toContain('refresh-token-value');
    expect(service.decrypt(encrypted)).toBe('refresh-token-value');
  });
});
