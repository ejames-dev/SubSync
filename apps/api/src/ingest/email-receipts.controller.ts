import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { EmailReceipt } from '@subscription-tracker/types';
import { EmailReceiptsService } from './email-receipts.service';
import { ListEmailReceiptsQueryDto } from './dto/list-email-receipts-query.dto';
import { ReviewEmailReceiptItemDto } from './dto/review-email-receipt-item.dto';

@Controller('email-receipts')
export class EmailReceiptsController {
  constructor(private readonly receipts: EmailReceiptsService) {}

  @Get()
  async list(
    @Query() query: ListEmailReceiptsQueryDto,
  ): Promise<EmailReceipt[]> {
    return this.receipts.list(query.status);
  }

  @Get(':id')
  async detail(@Param('id') id: string): Promise<EmailReceipt> {
    return this.receipts.findOne(id);
  }

  @Post(':receiptId/items/:itemId/approve')
  async approve(
    @Param('receiptId') receiptId: string,
    @Param('itemId') itemId: string,
    @Body() dto: ReviewEmailReceiptItemDto,
  ): Promise<EmailReceipt> {
    return this.receipts.approve(receiptId, itemId, dto);
  }

  @Post(':receiptId/items/:itemId/reject')
  async reject(
    @Param('receiptId') receiptId: string,
    @Param('itemId') itemId: string,
  ): Promise<EmailReceipt> {
    return this.receipts.reject(receiptId, itemId);
  }
}
