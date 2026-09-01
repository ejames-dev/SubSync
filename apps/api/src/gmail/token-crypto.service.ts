import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import { Injectable } from '@nestjs/common';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
// Fixed, application-specific salt for deriving the fallback encryption key
// below. This only raises the cost of attacking that fallback secret (in
// place of the single fast, unsalted hash CodeQL flags as
// js/insufficient-password-hash) -- it is not a substitute for configuring
// OAUTH_TOKEN_ENCRYPTION_KEY, which every real deployment should do.
const KEY_DERIVATION_SALT = 'subsync-token-crypto-v1';

@Injectable()
export class TokenCryptoService {
  private readonly key: Buffer;

  constructor() {
    const configured = process.env.OAUTH_TOKEN_ENCRYPTION_KEY?.trim();
    if (configured) {
      const decoded = Buffer.from(configured, 'base64');
      if (decoded.length !== 32) {
        throw new Error(
          'OAUTH_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.',
        );
      }
      this.key = decoded;
      return;
    }

    const fallbackSource =
      process.env.DATABASE_URL ??
      process.env.GOOGLE_OAUTH_CLIENT_SECRET ??
      'subsync-local-dev-key';
    this.key = scryptSync(fallbackSource, KEY_DERIVATION_SALT, KEY_LENGTH);
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
    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + 16);
    const encrypted = buffer.subarray(IV_LENGTH + 16);
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }
}
