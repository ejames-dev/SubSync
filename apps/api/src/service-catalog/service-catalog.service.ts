import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServiceProvider } from '@subscription-tracker/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { STREAMING_SERVICES } from './service-catalog.data';

@Injectable()
export class ServiceCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<ServiceProvider[]> {
    await this.seedDefaults();
    const services = await this.prisma.service.findMany();
    if (services.length === 0) {
      return STREAMING_SERVICES;
    }
    return services.map((service) => this.toDomain(service));
  }

  async createCustom(dto: CreateServiceDto): Promise<ServiceProvider> {
    const trimmedName = dto.name.trim();
    if (!trimmedName) {
      throw new BadRequestException('Service name cannot be empty.');
    }

    const baseSlug = trimmedName
      .slice(0, 120)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .join('_')
      .slice(0, 40);
    const slug = baseSlug || 'provider';
    const candidateBase = `svc_custom_${slug}`;
    const existing = await this.prisma.service.findUnique({
      where: { id: candidateBase },
    });
    const id = existing
      ? `${candidateBase}_${randomBytes(3).toString('hex')}`
      : candidateBase;

    const created = await this.prisma.service.create({
      data: {
        id,
        name: trimmedName,
        category: dto.category,
        supportsOAuth: false,
        isCustom: true,
        description: dto.description?.trim() || null,
        logoUrl: dto.logoUrl?.trim() || null,
        cancelUrl: dto.cancelUrl?.trim() || null,
      },
    });
    return this.toDomain(created);
  }

  async update(id: string, dto: UpdateServiceDto): Promise<ServiceProvider> {
    await this.seedDefaults();
    const existing = await this.prisma.service.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Service ${id} not found`);
    }

    const updated = await this.prisma.service.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() || null }
          : {}),
        ...(dto.logoUrl !== undefined
          ? { logoUrl: dto.logoUrl.trim() || null }
          : {}),
        ...(dto.cancelUrl !== undefined
          ? { cancelUrl: dto.cancelUrl.trim() || null }
          : {}),
      },
    });
    return this.toDomain(updated);
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
      logoUrl: service.logoUrl ?? null,
      cancelUrl: service.cancelUrl ?? null,
    };
  }

  private toDomain(service: {
    id: string;
    name: string;
    category: string;
    supportsOAuth: boolean;
    isCustom?: boolean;
    description: string | null;
    logoUrl: string | null;
    cancelUrl: string | null;
  }): ServiceProvider {
    return {
      id: service.id,
      name: service.name,
      category: service.category as ServiceProvider['category'],
      supportsOAuth: service.supportsOAuth,
      ...(service.isCustom ? { isCustom: true } : {}),
      description: service.description ?? undefined,
      logoUrl: service.logoUrl ?? undefined,
      cancelUrl: service.cancelUrl ?? undefined,
    };
  }
}
