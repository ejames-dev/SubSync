import {
  BadRequestException,
  Body,
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
import {
  DataBackupInfo,
  DataRestoreResult,
  EncryptedSyncResult,
  SubscriptionImportColumnMap,
  SubscriptionImportResult,
} from '@subscription-tracker/types';
import { DataBackupService } from './data-backup.service';
import { DataExportService } from './data-export.service';
import { DataImportService } from './data-import.service';
import { DataSyncService } from './data-sync.service';

@Controller('data')
export class DataController {
  constructor(
    private readonly exportService: DataExportService,
    private readonly importService: DataImportService,
    private readonly backupService: DataBackupService,
    private readonly syncService: DataSyncService,
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

  @Post('import/subscriptions')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async importSubscriptions(
    @UploadedFile()
    file: { buffer: Buffer; originalname?: string } | undefined,
    @Body()
    body: {
      content?: string;
      format?: 'csv' | 'json';
      columnMap?: string | SubscriptionImportColumnMap;
    },
  ): Promise<SubscriptionImportResult> {
    const content = file?.buffer
      ? file.buffer.toString('utf8')
      : (body?.content ?? '');
    if (!content.trim()) {
      throw new BadRequestException(
        'Provide a CSV/JSON file upload or content string.',
      );
    }

    const inferredFormat: 'csv' | 'json' | undefined =
      body?.format ??
      (file?.originalname?.toLowerCase().endsWith('.json')
        ? 'json'
        : file?.originalname?.toLowerCase().endsWith('.csv')
          ? 'csv'
          : undefined);

    let parsedMap: SubscriptionImportColumnMap | undefined;
    if (typeof body?.columnMap === 'string' && body.columnMap.trim()) {
      try {
        parsedMap = JSON.parse(body.columnMap) as SubscriptionImportColumnMap;
      } catch {
        throw new BadRequestException('Invalid columnMap JSON.');
      }
    } else if (body?.columnMap && typeof body.columnMap === 'object') {
      parsedMap = body.columnMap;
    }

    return this.importService.importSubscriptions({
      content,
      format: inferredFormat,
      columnMap: parsedMap,
    });
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

  @Post('sync/export')
  async exportEncryptedSync(
    @Body() body: { passphrase?: string },
    @Res() response: Response,
  ): Promise<void> {
    const buffer = await this.syncService.exportEncryptedBuffer(
      body?.passphrase ?? '',
    );
    const timestamp = new Date().toISOString().slice(0, 10);
    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="subsync-sync-${timestamp}.subsync.enc"`,
    );
    response.send(buffer);
  }

  @Post('sync/import')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  importEncryptedSync(
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Body() body: { passphrase?: string },
  ): Promise<EncryptedSyncResult> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Encrypted sync file is required.');
    }
    return this.syncService.importEncryptedBuffer(
      file.buffer,
      body?.passphrase ?? '',
    );
  }

  @Post('sync/push')
  pushEncryptedSync(
    @Body() body: { passphrase?: string; folderPath?: string },
  ): Promise<EncryptedSyncResult> {
    return this.syncService.pushToSyncFolder(
      body?.passphrase ?? '',
      body?.folderPath,
    );
  }

  @Post('sync/pull')
  pullEncryptedSync(
    @Body() body: { passphrase?: string; folderPath?: string },
  ): Promise<EncryptedSyncResult> {
    return this.syncService.pullFromSyncFolder(
      body?.passphrase ?? '',
      body?.folderPath,
    );
  }
}
