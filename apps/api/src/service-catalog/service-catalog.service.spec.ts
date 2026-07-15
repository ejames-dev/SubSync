import { PrismaService } from '../prisma/prisma.service';
import { STREAMING_SERVICES } from './service-catalog.data';
import { ServiceCatalogService } from './service-catalog.service';

describe('ServiceCatalogService', () => {
  const prisma = {
    service: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };
  let service: ServiceCatalogService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.service.upsert.mockResolvedValue(undefined);
    service = new ServiceCatalogService(prisma as unknown as PrismaService);
  });

  it('persists cancellation links while seeding the catalog', async () => {
    prisma.service.findMany.mockResolvedValue([]);

    const result = await service.findAll();

    expect(result).toEqual(STREAMING_SERVICES);
    expect(prisma.service.upsert).toHaveBeenCalledWith({
      where: { id: 'svc_netflix' },
      update: expect.objectContaining({
        cancelUrl: 'https://www.netflix.com/cancelplan',
      }),
      create: expect.objectContaining({
        id: 'svc_netflix',
        cancelUrl: 'https://www.netflix.com/cancelplan',
      }),
    });
  });

  it('returns persisted cancellation links through the service API', async () => {
    prisma.service.findMany.mockResolvedValue([
      {
        id: 'svc_spotify',
        name: 'Spotify',
        category: 'music',
        supportsOAuth: true,
        description: 'Premium music streaming',
        logoUrl: 'https://logo.clearbit.com/spotify.com',
        cancelUrl: 'https://support.spotify.com/us/article/cancel-premium/',
      },
    ]);

    await expect(service.findAll()).resolves.toEqual([
      expect.objectContaining({
        id: 'svc_spotify',
        cancelUrl: 'https://support.spotify.com/us/article/cancel-premium/',
      }),
    ]);
  });
});
