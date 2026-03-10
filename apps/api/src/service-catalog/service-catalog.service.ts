import { Injectable } from '@nestjs/common';
import { ServiceProvider } from '@subscription-tracker/types';
import { STREAMING_SERVICES } from './service-catalog.data';

@Injectable()
export class ServiceCatalogService {
  findAll(): ServiceProvider[] {
    return STREAMING_SERVICES;
  }
}
