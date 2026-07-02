import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EmailIngestService } from './email-ingest.service';
import { EmailIngestPayload } from './email-ingest.controller';

describe('EmailIngestService', () => {
  const services = {
    findAll: jest.fn(),
  };
  const subscriptions = {
    upsertImported: jest.fn(),
  };
  const integrations = {
    recordSync: jest.fn(),
  };

  const netflix = {
    id: 'svc_netflix',
    name: 'Netflix',
    category: 'video',
    supportsOAuth: false,
  };

  const basePayload: EmailIngestPayload = {
    sender: 'info@netflix.com',
    subject: 'Your Netflix receipt',
    body: '',
    receivedAt: '2026-06-01T00:00:00.000Z',
  } as EmailIngestPayload;

  beforeEach(() => {
    jest.clearAllMocks();
    services.findAll.mockResolvedValue([netflix]);
    subscriptions.upsertImported.mockImplementation(async (input) => ({
      mode: 'created',
      subscription: { id: 'sub_1', ...input },
    }));
    integrations.recordSync.mockResolvedValue(undefined);
  });

  const createService = () =>
    new EmailIngestService(
      services as never,
      subscriptions as never,
      integrations as never,
    );

  it('imports a subscription with the parsed amount', async () => {
    const service = createService();
    const result = await service.ingest({
      ...basePayload,
      body: 'Your Netflix Standard plan renews on June 15, 2026 for $15.49.',
    });

    expect(result.status).toBe('created');
    expect(subscriptions.upsertImported).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: 'svc_netflix',
        billingAmount: 15.49,
        billingCurrency: 'USD',
        billingInterval: 'monthly',
      }),
    );
    expect(integrations.recordSync).toHaveBeenCalledWith(
      'svc_netflix',
      'email',
    );
  });

  it('detects EUR currency and yearly interval', async () => {
    const service = createService();
    await service.ingest({
      ...basePayload,
      body: 'Your Netflix annual plan renews for €99.99.',
    });

    expect(subscriptions.upsertImported).toHaveBeenCalledWith(
      expect.objectContaining({
        billingAmount: 99.99,
        billingCurrency: 'EUR',
        billingInterval: 'yearly',
      }),
    );
  });

  it('rejects emails without a detectable billing amount', async () => {
    const service = createService();

    await expect(
      service.ingest({
        ...basePayload,
        body: 'Thanks for being a Netflix member. Enjoy your shows!',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    expect(subscriptions.upsertImported).not.toHaveBeenCalled();
    expect(integrations.recordSync).not.toHaveBeenCalled();
  });

  it('rejects emails without a recognizable provider', async () => {
    const service = createService();

    await expect(
      service.ingest({
        ...basePayload,
        sender: 'billing@example.com',
        subject: 'Your receipt',
        body: 'You paid $12.00 for something.',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(subscriptions.upsertImported).not.toHaveBeenCalled();
  });
});
