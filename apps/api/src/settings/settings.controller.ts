import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { UserSettings } from '@subscription-tracker/types';
import { OutboundAlertService } from '../notifications/outbound-alert.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly outboundAlerts: OutboundAlertService,
  ) {}

  @Get()
  async getSettings(): Promise<UserSettings> {
    return this.settings.getSettings();
  }

  @Put()
  async updateSettings(@Body() dto: UpdateSettingsDto): Promise<UserSettings> {
    return this.settings.updateSettings(dto);
  }

  @Post('test-alert')
  async sendTestAlert(): Promise<{
    webhookSent: boolean;
    smtpSent: boolean;
  }> {
    const message = {
      title: 'SubSync test alert',
      body: 'Your local SubSync outbound alert configuration is working.',
    };
    const [webhookSent, smtpSent] = await Promise.all([
      this.outboundAlerts.sendWebhookIfConfigured(message),
      this.outboundAlerts.sendSmtpEmailIfConfigured(message),
    ]);
    return { webhookSent, smtpSent };
  }
}
