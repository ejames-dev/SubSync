import { Module } from '@nestjs/common';
import { TokenCryptoService } from '../gmail/token-crypto.service';
import { OutboundAlertService } from '../notifications/outbound-alert.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, TokenCryptoService, OutboundAlertService],
  exports: [SettingsService],
})
export class SettingsModule {}
