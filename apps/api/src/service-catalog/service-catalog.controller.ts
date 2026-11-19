import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ServiceProvider } from '@subscription-tracker/types';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceCatalogService } from './service-catalog.service';

@Controller('services')
export class ServiceCatalogController {
  constructor(private readonly serviceCatalog: ServiceCatalogService) {}

  @Get()
  async list(): Promise<ServiceProvider[]> {
    return this.serviceCatalog.findAll();
  }

  @Post()
  async create(@Body() dto: CreateServiceDto): Promise<ServiceProvider> {
    return this.serviceCatalog.createCustom(dto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ): Promise<ServiceProvider> {
    return this.serviceCatalog.update(id, dto);
  }
}
