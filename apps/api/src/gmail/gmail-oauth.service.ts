import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  GmailAuthUrlResponse,
  GmailConnectionStatus,
} from '@subscription-tracker/types';
import { PrismaService } from '../prisma/prisma.service';
import { TokenCryptoService } from './token-crypto.service';

const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

type GoogleUserInfo = {
  email?: string;
};

@Injectable()
export class GmailOAuthService {
  private readonly logger = new Logger(GmailOAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenCrypto: TokenCryptoService,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim(),
    );
  }

  getRedirectUri(): string {
    return (
      process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ??
      'http://127.0.0.1:43100/api/gmail/callback'
    );
  }

  getWebReturnUrl(): string {
    return (
      process.env.GMAIL_OAUTH_RETURN_URL?.trim() ??
      'http://127.0.0.1:43101/connect'
    );
  }

  async getStatus(): Promise<GmailConnectionStatus> {
    const configured = this.isConfigured();
    const connection = await this.prisma.gmailConnection.findUnique({
      where: { id: 'default' },
    });

    if (!connection) {
      return { connected: false, configured };
    }

    return {
      connected: true,
      configured,
      email: connection.email ?? undefined,
      connectedAt: connection.connectedAt.toISOString(),
      lastSyncedAt: connection.lastSyncedAt?.toISOString(),
    };
  }

  async createAuthUrl(): Promise<GmailAuthUrlResponse> {
    this.assertConfigured();

    const state = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);

    await this.prisma.oAuthState.create({
      data: {
        state,
        provider: 'gmail',
        expiresAt,
      },
    });

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
      redirect_uri: this.getRedirectUri(),
      response_type: 'code',
      scope: GMAIL_READONLY_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return {
      authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      state,
    };
  }

  async handleCallback(code: string, state: string): Promise<string> {
    this.assertConfigured();

    const oauthState = await this.prisma.oAuthState.findUnique({
      where: { state },
    });
    if (!oauthState || oauthState.provider !== 'gmail') {
      throw new BadRequestException('Invalid OAuth state.');
    }
    if (oauthState.expiresAt.getTime() < Date.now()) {
      await this.prisma.oAuthState
        .delete({ where: { state } })
        .catch(() => undefined);
      throw new BadRequestException(
        'OAuth state expired. Try connecting again.',
      );
    }

    await this.prisma.oAuthState.delete({ where: { state } });

    const tokenResponse = await this.exchangeAuthorizationCode(code);
    const email = await this.fetchGoogleEmail(tokenResponse.access_token);

    const refreshToken = tokenResponse.refresh_token;
    if (!refreshToken) {
      throw new BadRequestException(
        'Google did not return a refresh token. Disconnect Gmail in your Google account and try again.',
      );
    }

    const tokenExpiry = new Date(Date.now() + tokenResponse.expires_in * 1000);
    const scopes = tokenResponse.scope ?? GMAIL_READONLY_SCOPE;

    await this.prisma.gmailConnection.upsert({
      where: { id: 'default' },
      update: {
        email,
        accessTokenEnc: this.tokenCrypto.encrypt(tokenResponse.access_token),
        refreshTokenEnc: this.tokenCrypto.encrypt(refreshToken),
        tokenExpiry,
        scopes,
        lastSyncedAt: null,
      },
      create: {
        email,
        accessTokenEnc: this.tokenCrypto.encrypt(tokenResponse.access_token),
        refreshTokenEnc: this.tokenCrypto.encrypt(refreshToken),
        tokenExpiry,
        scopes,
      },
    });

    const returnUrl = new URL(this.getWebReturnUrl());
    returnUrl.searchParams.set('gmail', 'connected');
    if (email) {
      returnUrl.searchParams.set('email', email);
    }
    return returnUrl.toString();
  }

  async disconnect(): Promise<GmailConnectionStatus> {
    const connection = await this.prisma.gmailConnection.findUnique({
      where: { id: 'default' },
    });

    if (connection) {
      try {
        const refreshToken = this.tokenCrypto.decrypt(
          connection.refreshTokenEnc,
        );
        await this.revokeToken(refreshToken);
      } catch (error) {
        this.logger.warn(
          `Failed to revoke Gmail token: ${error instanceof Error ? error.message : error}`,
        );
      }

      await this.prisma.gmailConnection.delete({ where: { id: 'default' } });
    }

    return this.getStatus();
  }

  async getValidAccessToken(): Promise<string> {
    const connection = await this.prisma.gmailConnection.findUnique({
      where: { id: 'default' },
    });
    if (!connection) {
      throw new BadRequestException('Gmail is not connected.');
    }

    const expiresSoon =
      !connection.tokenExpiry ||
      connection.tokenExpiry.getTime() <= Date.now() + 60_000;

    if (!expiresSoon) {
      return this.tokenCrypto.decrypt(connection.accessTokenEnc);
    }

    const refreshed = await this.refreshAccessToken(
      this.tokenCrypto.decrypt(connection.refreshTokenEnc),
    );
    const tokenExpiry = new Date(Date.now() + refreshed.expires_in * 1000);

    await this.prisma.gmailConnection.update({
      where: { id: 'default' },
      data: {
        accessTokenEnc: this.tokenCrypto.encrypt(refreshed.access_token),
        tokenExpiry,
        scopes: refreshed.scope ?? connection.scopes,
      },
    });

    return refreshed.access_token;
  }

  private async refreshAccessToken(
    refreshToken: string,
  ): Promise<GoogleTokenResponse> {
    this.assertConfigured();

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!.trim(),
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Gmail token refresh failed: ${body}`);
      throw new BadRequestException(
        'Gmail authorization expired. Please reconnect Gmail.',
      );
    }

    return (await response.json()) as GoogleTokenResponse;
  }

  private async exchangeAuthorizationCode(
    code: string,
  ): Promise<GoogleTokenResponse> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!.trim(),
        redirect_uri: this.getRedirectUri(),
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Gmail OAuth exchange failed: ${body}`);
      throw new BadRequestException('Failed to complete Gmail authorization.');
    }

    return (await response.json()) as GoogleTokenResponse;
  }

  private async fetchGoogleEmail(
    accessToken: string,
  ): Promise<string | undefined> {
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      return undefined;
    }

    const profile = (await response.json()) as GoogleUserInfo;
    return profile.email;
  }

  private async revokeToken(token: string): Promise<void> {
    await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Gmail OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.',
      );
    }
  }
}
