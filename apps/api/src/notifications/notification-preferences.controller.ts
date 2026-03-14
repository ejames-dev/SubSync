import { Body, Controller, Get, Put } from '@nestjs/common';
import { NotificationPreferencesService } from './notification-preferences.service';
import { UpdateNotificationPreferenceDto } from './dto/update-notification-preference.dto';
import { NotificationPreference } from '@subscription-tracker/types';

@Controller('notifications/preferences')
export class NotificationPreferencesController {
  constructor(
    private readonly notificationPreferences: NotificationPreferencesService,
  ) {}

  @Get()
  getPreference(): Promise<NotificationPreference> {
    return this.notificationPreferences.getPreference();
  }

  @Put()
  updatePreference(
    @Body() dto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreference> {
    return this.notificationPreferences.update(dto);
  }
}
