import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  NotificationChannel,
  PendingRenewalNotification,
} from '@subscription-tracker/types';
import { NotificationDeliveryService } from './notification-delivery.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly delivery: NotificationDeliveryService) {}

  @Get('pending')
  listPending(
    @Query('channel') channel?: string,
  ): Promise<PendingRenewalNotification[]> {
    const normalized =
      channel === 'email' || channel === 'push' ? channel : 'push';
    return this.delivery.listPending(normalized as NotificationChannel);
  }

  @Post(':id/ack')
  acknowledge(
    @Param('id') id: string,
  ): Promise<PendingRenewalNotification> {
    return this.delivery.acknowledge(id);
  }
}
