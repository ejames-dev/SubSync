import { CalendarService } from './calendar.service';

describe('CalendarService', () => {
  it('generates RFC 5545 iCalendar feed with RRULE and VALARM triggers', async () => {
    const subscriptions = {
      list: jest.fn().mockResolvedValue([
        {
          id: 'sub_1',
          serviceId: 'svc_netflix',
          planName: 'Standard',
          status: 'active',
          billingAmount: 15.49,
          billingCurrency: 'USD',
          billingInterval: 'monthly',
          nextRenewal: '2026-12-01T00:00:00.000Z',
          leadTimeDaysOverride: 3,
          statusChangedAt: '2026-11-01T00:00:00.000Z',
        },
        {
          id: 'sub_paused',
          serviceId: 'svc_netflix',
          planName: 'Paused Plan',
          status: 'paused',
          billingAmount: 9.99,
          billingCurrency: 'USD',
          billingInterval: 'monthly',
          nextRenewal: '2026-12-05T00:00:00.000Z',
          statusChangedAt: '2026-11-01T00:00:00.000Z',
        },
      ]),
    };
    const services = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: 'svc_netflix',
          name: 'Netflix',
          category: 'streaming',
          supportsOAuth: false,
          cancelUrl: 'https://www.netflix.com/cancelplan',
        },
      ]),
    };
    const settings = {
      getSettings: jest.fn().mockResolvedValue({
        notificationPreference: {
          id: 'default',
          leadTimeDays: 7,
          channels: ['push'],
        },
        budgetCurrency: 'USD',
        emailForwardingAlias: 'subs+general@subsync.app',
      }),
    };

    const calendar = new CalendarService(
      subscriptions as never,
      services as never,
      settings as never,
    );

    const ics = await calendar.generateIcsFeed(
      new Date('2026-11-19T12:00:00.000Z'),
    );

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('UID:subsync-sub_1@subsync.local');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261201');
    expect(ics).toContain('RRULE:FREQ=MONTHLY;INTERVAL=1');
    expect(ics).toContain('TRIGGER:-P3D');
    expect(ics).not.toContain('sub_paused');
  });
});
