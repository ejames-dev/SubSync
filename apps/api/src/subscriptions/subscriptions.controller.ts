import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { Subscription } from '@subscription-tracker/types';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  async list(): Promise<Subscription[]> {
    return this.subscriptions.list();
  }

  @Get(':id')
  async detail(@Param('id') id: string): Promise<Subscription> {
    return this.subscriptions.findOne(id);
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
