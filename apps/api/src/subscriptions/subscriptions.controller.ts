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
  list(): Subscription[] {
    return this.subscriptions.list();
  }

  @Get(':id')
  detail(@Param('id') id: string): Subscription {
    return this.subscriptions.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSubscriptionDto): Subscription {
    return this.subscriptions.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ): Subscription {
    return this.subscriptions.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string): void {
    return this.subscriptions.remove(id);
  }
}
