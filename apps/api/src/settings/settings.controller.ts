import { Body, Controller, Get, Put } from '@nestjs/common';
import { UserSettings } from '@subscription-tracker/types';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async getSettings(): Promise<UserSettings> {
    return this.settings.getSettings();
  }

  @Put()
  async updateSettings(@Body() dto: UpdateSettingsDto): Promise<UserSettings> {
    return this.settings.updateSettings(dto);
  }
}
