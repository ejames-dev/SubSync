import { Injectable } from '@nestjs/common';
import { NotificationPreference } from '@subscription-tracker/types';
import { SettingsService } from '../settings/settings.service';
import { UpdateNotificationPreferenceDto } from './dto/update-notification-preference.dto';

@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly settings: SettingsService) {}

  async getPreference(): Promise<NotificationPreference> {
    const userSettings = await this.settings.getSettings();
    return userSettings.notificationPreference;
  }

  async update(
    dto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreference> {
    const userSettings = await this.settings.updateSettings(dto);
    return userSettings.notificationPreference;
  }
}
