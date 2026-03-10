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
    return STREAMING_SERVICES;
  }
}
