import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { CalendarService } from './calendar.service';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('renewals.ics')
  async getRenewalsIcs(@Res() response: Response): Promise<void> {
    const ics = await this.calendarService.generateIcsFeed();
    response.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="subsync-renewals.ics"',
    );
    response.send(ics);
  }
}
