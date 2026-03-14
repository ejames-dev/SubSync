import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { Subscription, SubscriptionEvent } from '@subscription-tracker/types';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  async list(): Promise<Subscription[]> {
    return this.subscriptions.list();
  }

  @Get('events/recent')
  async recent(@Query('limit') limit?: string): Promise<SubscriptionEvent[]> {
    const parsed = limit !== undefined ? Number(limit) : undefined;
    const normalized =
      parsed !== undefined && Number.isNaN(parsed) ? undefined : parsed;
    return this.subscriptions.recentEvents(normalized);
  }

  @Get(':id')
  async detail(@Param('id') id: string): Promise<Subscription> {
    return this.subscriptions.findOne(id);
  }

  @Get(':id/events')
  async events(@Param('id') id: string): Promise<SubscriptionEvent[]> {
    return this.subscriptions.listEvents(id);
  }

  @Post()
  async create(@Body() dto: CreateSubscriptionDto): Promise<Subscription> {
    return this.subscriptions.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ): Promise<Subscription> {
    return this.subscriptions.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.subscriptions.remove(id);
  }
}
