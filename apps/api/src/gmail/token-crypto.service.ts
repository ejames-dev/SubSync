import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { getSqliteFilePath } from '../data/sqlite-path.util';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
// Fixed, application-specific salt for the legacy fallback derivations below.
// Those derivations are kept only so tokens encrypted by older builds (which
// derived the key deterministically from DATABASE_URL & friends) can still be
// decrypted and re-encrypted under the real key. New tokens are never
// encrypted with a derived key.
const KEY_DERIVATION_SALT = 'subsync-token-crypto-v1';
const KEY_FILE_NAME = 'oauth-token-key.key';

@Injectable()
export class TokenCryptoService {
  private readonly logger = new Logger(TokenCryptoService.name);
  private readonly key: Buffer;
  private legacyKeys: Buffer[] | undefined;

  constructor() {
    const configured = process.env.OAUTH_TOKEN_ENCRYPTION_KEY?.trim();
    if (configured) {
      const decoded = Buffer.from(configured, 'base64');
      if (decoded.length !== KEY_LENGTH) {
        throw new Error(
          'OAUTH_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.',
        );
      }
      this.key = decoded;
      return;
    }

    this.key = this.loadOrCreatePersistedKey();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(payload: string): string {
    const buffer = Buffer.from(payload, 'base64');
    try {
      return this.decryptWithKey(buffer, this.key);
    } catch (primaryError) {
      // Tokens stored by older builds were encrypted under a key derived
      // deterministically from DATABASE_URL (first SHA-256, later scrypt).
      // Try those legacy keys so existing Gmail connections survive the
      // upgrade; callers re-encrypt on next token refresh.
      for (const legacyKey of this.getLegacyKeys()) {
        try {
          return this.decryptWithKey(buffer, legacyKey);
        } catch {
          // Not this legacy key either — keep trying.
        }
      }
      throw primaryError;
    }
  }

  private decryptWithKey(buffer: Buffer, key: Buffer): string {
    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }

  /**
   * When OAUTH_TOKEN_ENCRYPTION_KEY is not configured (standalone/dev API
   * runs; the desktop shell always injects an explicit key), persist a
   * randomly generated key next to the SQLite database instead of deriving
   * one from predictable inputs such as the database path. Anyone who can
   * guess DATABASE_URL must not be able to decrypt stored OAuth tokens.
   */
  private loadOrCreatePersistedKey(): Buffer {
    const keyFilePath = this.getKeyFilePath();
    const existing = this.readKeyFile(keyFilePath);
    if (existing) {
      return existing;
    }

    const generated = randomBytes(KEY_LENGTH);
    try {
      mkdirSync(dirname(keyFilePath), { recursive: true });
      writeFileSync(keyFilePath, generated.toString('base64'), {
        encoding: 'utf8',
        mode: 0o600,
        flag: 'wx',
      });
      this.logger.warn(
        `OAUTH_TOKEN_ENCRYPTION_KEY is not set; generated a local token encryption key at ${keyFilePath}. Back this file up with your database — losing it means reconnecting Gmail.`,
      );
      return generated;
    } catch (error) {
      // Another process may have created the file first (flag: 'wx').
      const raced = this.readKeyFile(keyFilePath);
      if (raced) {
        return raced;
      }
      throw error;
    }
  }

  private readKeyFile(keyFilePath: string): Buffer | null {
    if (!existsSync(keyFilePath)) {
      return null;
    }
    const decoded = Buffer.from(
      readFileSync(keyFilePath, 'utf8').trim(),
      'base64',
    );
    if (decoded.length !== KEY_LENGTH) {
      throw new Error(
        `Token encryption key file at ${keyFilePath} is corrupt: expected a base64-encoded 32-byte key.`,
      );
    }
    return decoded;
  }

  private getKeyFilePath(): string {
    const configured = process.env.OAUTH_TOKEN_KEY_FILE?.trim();
    if (configured) {
      return resolve(configured);
    }
    return resolve(dirname(getSqliteFilePath()), KEY_FILE_NAME);
  }

  private getLegacyKeys(): Buffer[] {
    if (!this.legacyKeys) {
      const sources = [
        ...new Set(
          [
            process.env.DATABASE_URL,
            process.env.GOOGLE_OAUTH_CLIENT_SECRET,
            'subsync-local-dev-key',
          ].filter((value): value is string => Boolean(value)),
        ),
      ];
      this.legacyKeys = sources.flatMap((source) => [
        scryptSync(source, KEY_DERIVATION_SALT, KEY_LENGTH),
        createHash('sha256').update(source).digest(),
      ]);
    }
    return this.legacyKeys;
  }
}
