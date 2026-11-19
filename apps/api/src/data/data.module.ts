import { Module } from '@nestjs/common';
import { ServiceCatalogModule } from '../service-catalog/service-catalog.module';
import { DataBackupService } from './data-backup.service';
import { DataController } from './data.controller';
import { DataExportService } from './data-export.service';
import { DataImportService } from './data-import.service';

@Module({
  imports: [ServiceCatalogModule],
  controllers: [DataController],
  providers: [DataExportService, DataImportService, DataBackupService],
  exports: [DataExportService, DataImportService, DataBackupService],
})
export class DataModule {}
