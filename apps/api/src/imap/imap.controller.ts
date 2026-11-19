import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import {
  ImapConnectionStatus,
  ImapSyncResult,
} from '@subscription-tracker/types';
import { ConnectImapDto } from './dto/connect-imap.dto';
import { ImapService } from './imap.service';

@Controller('imap')
export class ImapController {
  constructor(private readonly imapService: ImapService) {}

  @Get('status')
  getStatus(): Promise<ImapConnectionStatus> {
    return this.imapService.getStatus();
  }

  @Post('connect')
  connect(@Body() dto: ConnectImapDto): Promise<ImapConnectionStatus> {
    return this.imapService.connect(dto);
  }

  @Post('sync')
  sync(): Promise<ImapSyncResult> {
    return this.imapService.syncBillingEmails();
  }

  @Delete('disconnect')
  disconnect(): Promise<ImapConnectionStatus> {
    return this.imapService.disconnect();
  }
}
