import { Injectable } from '@nestjs/common';
import { ServiceProvider } from '@subscription-tracker/types';
import { STREAMING_SERVICES } from './service-catalog.data';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServiceCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<ServiceProvider[]> {
    const services = await this.prisma.service.findMany();
    if (services.length > 0) {
      return services.map((service) => ({
        id: service.id,
        name: service.name,
        category: service.category as ServiceProvider['category'],
        supportsOAuth: service.supportsOAuth,
        description: service.description ?? undefined,
      }));
    }
    await this.seedDefaults();
    return STREAMING_SERVICES;
  }

  async ensureExists(id: string): Promise<boolean> {
    const existing = await this.prisma.service.findUnique({ where: { id } });
    if (existing) {
      return true;
    }

    const fallback = STREAMING_SERVICES.find((service) => service.id === id);
    if (!fallback) {
      return false;
    }

    await this.prisma.service.upsert({
      where: { id: fallback.id },
      update: this.toPersistenceData(fallback),
      create: {
        id: fallback.id,
        ...this.toPersistenceData(fallback),
      },
    });

    return true;
  }

  private async seedDefaults(): Promise<void> {
    await Promise.all(
      STREAMING_SERVICES.map((service) =>
        this.prisma.service.upsert({
          where: { id: service.id },
          update: this.toPersistenceData(service),
          create: {
            id: service.id,
            ...this.toPersistenceData(service),
          },
        }),
      ),
    );
  }

  private toPersistenceData(service: ServiceProvider) {
    return {
      name: service.name,
      category: service.category,
      supportsOAuth: service.supportsOAuth,
      description: service.description ?? null,
    };
  }
}
