import { BankStatementIngestService } from './bank-statement-ingest.service';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceCatalogService } from '../service-catalog/service-catalog.service';

describe('BankStatementIngestService', () => {
  it('clusters recurring monthly charges and queues review items locally', async () => {
    const prisma = {
      emailReceipt: {
        create: jest.fn().mockResolvedValue({ id: 'rcpt_bank_1' }),
      },
      emailReceiptItem: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'item_1',
            ...data,
            createdAt: new Date('2026-11-19T00:00:00.000Z'),
            updatedAt: new Date('2026-11-19T00:00:00.000Z'),
          }),
        ),
      },
    };
    const services = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: 'svc_netflix',
          name: 'Netflix',
          category: 'streaming',
          supportsOAuth: false,
        },
      ]),
    };

    const analyzer = new BankStatementIngestService(
      prisma as unknown as PrismaService,
      services as unknown as ServiceCatalogService,
    );

    const csv = [
      'Date,Description,Amount',
      '2026-08-15,"POS DEBIT NETFLIX.COM *1122",-15.49',
      '2026-09-15,"POS DEBIT NETFLIX.COM *8841",-15.49',
      '2026-10-15,"POS DEBIT NETFLIX.COM *9932",-15.49',
      '2026-10-18,"CORNER COFFEE SHOP",-4.75',
    ].join('\n');

    const result = await analyzer.analyzeCsv(csv, 'USD');

    expect(result.detectedGroups).toBe(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        serviceId: 'svc_netflix',
        providerName: 'Netflix',
        billingAmount: 15.49,
        billingInterval: 'monthly',
        nextRenewal: '2026-11-15T00:00:00.000Z',
        action: 'review',
      }),
    );
  });
});
