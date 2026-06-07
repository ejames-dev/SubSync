import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  IntegrationConnection,
  IntegrationSource,
} from '@subscription-tracker/types';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get()
  async list(): Promise<IntegrationConnection[]> {
    return this.integrations.listConnections();
  }

  @Post(':provider/connect')
  async connect(
    @Param('provider') provider: string,
    @Body() body: Record<string, any>,
  ): Promise<{ connection: IntegrationConnection; message: string }> {
    const source =
      body?.source === 'oauth' || body?.source === 'email'
        ? (body.source as IntegrationSource)
        : 'manual';

    return this.integrations.connect(provider, source);
  }

  @Delete(':provider')
  async disconnect(
    @Param('provider') provider: string,
  ): Promise<{ message: string }> {
    return this.integrations.disconnect(provider);
  }
}
