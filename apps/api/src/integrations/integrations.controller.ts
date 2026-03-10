import { Body, Controller, Param, Post } from '@nestjs/common';

@Controller('integrations')
export class IntegrationsController {
  @Post(':provider/connect')
  connect(
    @Param('provider') provider: string,
    @Body() body: Record<string, any>,
  ) {
    return {
      provider,
      status: 'pending',
      message: `Integration handshake queued for ${provider}`,
      received: body,
    };
  }
}
