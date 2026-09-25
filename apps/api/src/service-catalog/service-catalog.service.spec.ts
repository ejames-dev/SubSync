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

  it('ships a catalog with unique ids and names and an https cancel link for every entry', () => {
    const ids = STREAMING_SERVICES.map((entry) => entry.id);
    const names = STREAMING_SERVICES.map((entry) => entry.name.toLowerCase());
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);

    for (const entry of STREAMING_SERVICES) {
      expect(entry.id).toMatch(/^svc_[a-z0-9_]+$/);
      expect(['streaming', 'music', 'gaming', 'other']).toContain(
        entry.category,
      );
      expect(new URL(entry.cancelUrl ?? '').protocol).toBe('https:');
      expect(new URL(entry.logoUrl ?? '').protocol).toBe('https:');
    }
  });

  it('includes the expanded streaming, gaming, and membership services', () => {
    expect(STREAMING_SERVICES.map((entry) => entry.name)).toEqual(
      expect.arrayContaining([
        'Paramount+',
        'Amazon Prime',
        'Crunchyroll',
        'HBO Max',
        'Peacock',
        'Xbox Game Pass',
        'PlayStation Plus',
        'Nintendo Switch Online',
        'Audible',
      ]),
    );
  });

  it('upserts new catalog entries into an existing database', async () => {
    prisma.service.findMany.mockResolvedValue([]);

    await service.findAll();

    expect(prisma.service.upsert).toHaveBeenCalledTimes(
      STREAMING_SERVICES.length,
    );
    expect(prisma.service.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'svc_xbox_game_pass' },
        create: expect.objectContaining({
          name: 'Xbox Game Pass',
          category: 'gaming',
        }),
      }),
    );
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
