import {
  createCipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TokenCryptoService } from './token-crypto.service';

function encryptWithKey(key: Buffer, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

describe('TokenCryptoService', () => {
  const previousKey = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  const previousKeyFile = process.env.OAUTH_TOKEN_KEY_FILE;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  let workDir: string;
  let keyFilePath: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'subsync-token-crypto-test-'));
    keyFilePath = join(workDir, 'oauth-token-key.key');
    process.env.OAUTH_TOKEN_KEY_FILE = keyFilePath;
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
      'base64',
    );
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
    if (previousKey === undefined) {
      delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.OAUTH_TOKEN_ENCRYPTION_KEY = previousKey;
    }
    if (previousKeyFile === undefined) {
      delete process.env.OAUTH_TOKEN_KEY_FILE;
    } else {
      process.env.OAUTH_TOKEN_KEY_FILE = previousKeyFile;
    }
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  it('encrypts and decrypts token values with the configured key', () => {
    const service = new TokenCryptoService();
    const encrypted = service.encrypt('refresh-token-value');
    expect(encrypted).not.toContain('refresh-token-value');
    expect(service.decrypt(encrypted)).toBe('refresh-token-value');
  });

  it('rejects a configured key that is not 32 bytes', () => {
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString(
      'base64',
    );
    expect(() => new TokenCryptoService()).toThrow(
      'OAUTH_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.',
    );
  });

  it('persists a random key file when no key is configured, shared across instances', () => {
    delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;

    const first = new TokenCryptoService();
    expect(existsSync(keyFilePath)).toBe(true);
    const stored = Buffer.from(
      readFileSync(keyFilePath, 'utf8').trim(),
      'base64',
    );
    expect(stored).toHaveLength(32);

    const encrypted = first.encrypt('refresh-token-value');
    const second = new TokenCryptoService();
    expect(second.decrypt(encrypted)).toBe('refresh-token-value');
  });

  it('does not derive the persisted key from DATABASE_URL', () => {
    delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
    process.env.DATABASE_URL = 'file:./dev.db';

    const service = new TokenCryptoService();
    const persisted = Buffer.from(
      readFileSync(keyFilePath, 'utf8').trim(),
      'base64',
    );
    const derived = scryptSync('file:./dev.db', 'subsync-token-crypto-v1', 32);
    expect(persisted.equals(derived)).toBe(false);
    expect(service.decrypt(service.encrypt('token'))).toBe('token');
  });

  it('still decrypts tokens encrypted with the legacy scrypt-derived key', () => {
    process.env.DATABASE_URL = 'file:./legacy.db';
    const legacyKey = scryptSync(
      'file:./legacy.db',
      'subsync-token-crypto-v1',
      32,
    );
    const payload = encryptWithKey(legacyKey, 'legacy-refresh-token');

    const service = new TokenCryptoService();
    expect(service.decrypt(payload)).toBe('legacy-refresh-token');
  });

  it('still decrypts tokens encrypted with the legacy sha256-derived key', () => {
    process.env.DATABASE_URL = 'file:./legacy.db';
    const legacyKey = createHash('sha256').update('file:./legacy.db').digest();
    const payload = encryptWithKey(legacyKey, 'legacy-refresh-token');

    const service = new TokenCryptoService();
    expect(service.decrypt(payload)).toBe('legacy-refresh-token');
  });

  it('throws for a payload no known key can decrypt', () => {
    const service = new TokenCryptoService();
    const foreign = encryptWithKey(randomBytes(32), 'foreign-token');
    expect(() => service.decrypt(foreign)).toThrow();
  });
});
