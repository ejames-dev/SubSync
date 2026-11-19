import { DataImportService } from './data-import.service';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceCatalogService } from '../service-catalog/service-catalog.service';

describe('DataImportService', () => {
  let service: DataImportService;
  let prisma: {
    subscription: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    subscriptionEvent: { create: jest.Mock };
  };
  let catalog: {
    findAll: jest.Mock;
    createCustom: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'sub_new', ...data }),
          ),
        update: jest.fn().mockResolvedValue({ id: 'sub_existing' }),
      },
      subscriptionEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    catalog = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: 'svc_netflix',
          name: 'Netflix',
          category: 'streaming',
          supportsOAuth: false,
        },
      ]),
      createCustom: jest.fn().mockImplementation(({ name }) =>
        Promise.resolve({
          id: `svc_custom_${name.toLowerCase()}`,
          name,
          category: 'other',
          supportsOAuth: false,
          isCustom: true,
        }),
      ),
    };

    service = new DataImportService(
      prisma as unknown as PrismaService,
      catalog as unknown as ServiceCatalogService,
    );
  });

  it('imports CSV rows with custom column mapping and auto-creates custom services', async () => {
    const csv = [
      'Vendor,Tier,Monthly Fee,Renewal',
      'Netflix,Standard,15.49,2026-12-01',
      'Linear,Basic,10.00,2026-12-05',
    ].join('\n');

    const result = await service.importSubscriptions({
      content: csv,
      format: 'csv',
      columnMap: {
        serviceName: 'Vendor',
        planName: 'Tier',
        billingAmount: 'Monthly Fee',
        nextRenewal: 'Renewal',
      },
    });

    expect(result).toEqual({
      created: 2,
      updated: 0,
      skipped: 0,
      errors: [],
    });
    expect(catalog.createCustom).toHaveBeenCalledWith({
      name: 'Linear',
      category: 'other',
    });
    expect(prisma.subscription.create).toHaveBeenCalledTimes(2);
  });

  it('updates matching subscriptions when importing JSON export payload', async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce({
      id: 'sub_1',
      notes: 'Keep me',
    });

    const json = JSON.stringify({
      exportedAt: '2026-11-19T00:00:00.000Z',
      version: '1.5.0',
      subscriptions: [
        {
          id: 'sub_1',
          serviceId: 'svc_netflix',
          serviceName: 'Netflix',
          planName: 'Premium',
          billingAmount: 22.99,
          billingCurrency: 'USD',
          billingInterval: 'monthly',
          nextRenewal: '2026-12-10T00:00:00.000Z',
        },
      ],
    });

    const result = await service.importSubscriptions({
      content: json,
      format: 'json',
    });

    expect(result).toEqual({
      created: 0,
      updated: 1,
      skipped: 0,
      errors: [],
    });
    expect(prisma.subscription.update).toHaveBeenCalledTimes(1);
  });

  it('skips rows with blank billingAmount instead of overwriting price with zero', async () => {
    const csv = [
      'serviceName,planName,billingAmount,nextRenewal',
      'Netflix,Standard,,2026-12-01',
    ].join('\n');

    const result = await service.importSubscriptions({
      content: csv,
      format: 'csv',
    });

    expect(result.skipped).toBe(1);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(prisma.subscription.create).not.toHaveBeenCalled();
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });
});
