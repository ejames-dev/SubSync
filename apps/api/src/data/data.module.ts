import { Module } from '@nestjs/common';
import { ServiceCatalogModule } from '../service-catalog/service-catalog.module';
import { DataBackupService } from './data-backup.service';
import { DataController } from './data.controller';
import { DataExportService } from './data-export.service';
import { DataImportService } from './data-import.service';
import { DataSyncService } from './data-sync.service';

@Module({
  imports: [ServiceCatalogModule],
  controllers: [DataController],
  providers: [
    DataExportService,
    DataImportService,
    DataBackupService,
    DataSyncService,
  ],
  exports: [
    DataExportService,
    DataImportService,
    DataBackupService,
    DataSyncService,
  ],
})
export class DataModule {}
