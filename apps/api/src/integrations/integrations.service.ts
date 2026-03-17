import { Injectable, NotFoundException } from '@nestjs/common';
import {
  IntegrationConnection,
  IntegrationSource,
  IntegrationStatus,
} from '@subscription-tracker/types';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceCatalogService } from '../service-catalog/service-catalog.service';

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceCatalog: ServiceCatalogService,
  ) {}

  async listConnections(): Promise<IntegrationConnection[]> {
    const connections = await this.prisma.integrationConnection.findMany();

    return connections.map((connection) => this.toDomain(connection));
  }

  async connect(
    providerId: string,
    source: IntegrationSource,
  ): Promise<{ connection: IntegrationConnection; message: string }> {
    const exists = await this.serviceCatalog.ensureExists(providerId);
    if (!exists) {
      throw new NotFoundException(`Unknown provider "${providerId}"`);
    }

    const status: IntegrationStatus =
      source === 'oauth' ? 'connected' : 'manual';
    const connectedAt = new Date();
    const lastSyncedAt = source === 'oauth' ? connectedAt : null;

    const connection = await this.prisma.integrationConnection.upsert({
      where: { providerId },
      update: {
        status,
        source,
        connectedAt,
        lastSyncedAt,
      },
      create: {
        providerId,
        status,
        source,
        connectedAt,
        lastSyncedAt,
      },
    });

    const message =
      source === 'oauth'
        ? `Connected ${providerId} through the local desktop app.`
        : `Saved ${providerId} for manual or email-based import.`;

    return {
      connection: this.toDomain(connection),
      message,
    };
  }

  async recordSync(
    providerId: string,
    source: IntegrationSource,
  ): Promise<IntegrationConnection> {
    const exists = await this.serviceCatalog.ensureExists(providerId);
    if (!exists) {
      throw new NotFoundException(`Unknown provider "${providerId}"`);
    }

    const now = new Date();
    const status: IntegrationStatus =
      source === 'oauth' ? 'connected' : 'manual';
    const connection = await this.prisma.integrationConnection.upsert({
      where: { providerId },
      update: {
        status,
        source,
        lastSyncedAt: now,
      },
      create: {
        providerId,
        status,
        source,
        connectedAt: now,
        lastSyncedAt: now,
      },
    });

    return this.toDomain(connection);
  }

  private toDomain(connection: {
    providerId: string;
    status: string;
    source: string;
    connectedAt: Date;
    lastSyncedAt: Date | null;
  }): IntegrationConnection {
    return {
      providerId: connection.providerId,
      status: connection.status as IntegrationStatus,
      source: connection.source as IntegrationSource,
      connectedAt: connection.connectedAt.toISOString(),
      lastSyncedAt: connection.lastSyncedAt?.toISOString(),
    };
  }
}
