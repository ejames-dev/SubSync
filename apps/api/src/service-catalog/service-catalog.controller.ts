import { Controller, Get } from '@nestjs/common';
import { ServiceCatalogService } from './service-catalog.service';
import { ServiceProvider } from '@subscription-tracker/types';

@Controller('services')
export class ServiceCatalogController {
  constructor(private readonly serviceCatalog: ServiceCatalogService) {}

  @Get()
  list(): ServiceProvider[] {
    return this.serviceCatalog.findAll();
  }
}
