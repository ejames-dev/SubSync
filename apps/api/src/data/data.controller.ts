import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { DataBackupInfo, DataRestoreResult } from '@subscription-tracker/types';
import { DataBackupService } from './data-backup.service';
import { DataExportService } from './data-export.service';

@Controller('data')
export class DataController {
  constructor(
    private readonly exportService: DataExportService,
    private readonly backupService: DataBackupService,
  ) {}

  @Get('export/subscriptions')
  async exportSubscriptions(
    @Query('format') format: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const normalized = format === 'csv' ? 'csv' : 'json';
    const timestamp = new Date().toISOString().slice(0, 10);

    if (normalized === 'csv') {
      const csv = await this.exportService.exportSubscriptionsCsv();
      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="subsync-subscriptions-${timestamp}.csv"`,
      );
      response.send(csv);
      return;
    }

    const json = await this.exportService.exportSubscriptionsJson();
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="subsync-subscriptions-${timestamp}.json"`,
    );
    response.send(json);
  }

  @Get('backups')
  listBackups(): DataBackupInfo[] {
    return this.backupService.listBackups();
  }

  @Post('backup')
  async createBackup(): Promise<DataBackupInfo> {
    return this.backupService.createBackup();
  }

  @Get('backup/:fileName')
  downloadBackup(
    @Param('fileName') fileName: string,
    @Res() response: Response,
  ): void {
    const filePath = this.backupService.getBackupFilePath(fileName);
    response.download(filePath, fileName);
  }

  @Post('restore')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async restoreFromUpload(
    @UploadedFile()
    file: { buffer: Buffer; originalname?: string } | undefined,
  ): Promise<DataRestoreResult> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Backup file is required.');
    }

    return this.backupService.restoreFromBuffer(
      file.buffer,
      file.originalname || 'uploaded-backup.db',
    );
  }

  @Post('restore/:fileName')
  restoreFromStoredBackup(
    @Param('fileName') fileName: string,
  ): Promise<DataRestoreResult> {
    return this.backupService.restoreFromBackupFile(fileName);
  }
}
