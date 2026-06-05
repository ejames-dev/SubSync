import {
  Controller,
  Get,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  GmailAuthUrlResponse,
  GmailConnectionStatus,
  GmailSyncResult,
} from '@subscription-tracker/types';
import { GmailOAuthService } from './gmail-oauth.service';
import { GmailSyncService } from './gmail-sync.service';

@Controller('gmail')
export class GmailController {
  constructor(
    private readonly gmailOAuth: GmailOAuthService,
    private readonly gmailSync: GmailSyncService,
  ) {}

  @Get('status')
  getStatus(): Promise<GmailConnectionStatus> {
    return this.gmailOAuth.getStatus();
  }

  @Get('auth-url')
  getAuthUrl(): Promise<GmailAuthUrlResponse> {
    return this.gmailOAuth.createAuthUrl();
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const returnUrl = new URL(this.gmailOAuth.getWebReturnUrl());

    if (error) {
      returnUrl.searchParams.set('gmail', 'error');
      returnUrl.searchParams.set('message', error);
      response.redirect(returnUrl.toString());
      return;
    }

    if (!code || !state) {
      returnUrl.searchParams.set('gmail', 'error');
      returnUrl.searchParams.set('message', 'Missing OAuth code or state.');
      response.redirect(returnUrl.toString());
      return;
    }

    try {
      const successUrl = await this.gmailOAuth.handleCallback(code, state);
      response.redirect(successUrl);
    } catch (callbackError) {
      returnUrl.searchParams.set('gmail', 'error');
      returnUrl.searchParams.set(
        'message',
        callbackError instanceof Error
          ? callbackError.message
          : 'Gmail authorization failed.',
      );
      response.redirect(returnUrl.toString());
    }
  }

  @Post('disconnect')
  disconnect(): Promise<GmailConnectionStatus> {
    return this.gmailOAuth.disconnect();
  }

  @Post('sync')
  sync(): Promise<GmailSyncResult> {
    return this.gmailSync.syncBillingEmails();
  }
}
