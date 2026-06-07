import { Module } from '@nestjs/common';
import { DataBackupService } from './data-backup.service';
import { DataController } from './data.controller';
import { DataExportService } from './data-export.service';

@Module({
  controllers: [DataController],
  providers: [DataExportService, DataBackupService],
  exports: [DataExportService, DataBackupService],
})
export class DataModule {}
