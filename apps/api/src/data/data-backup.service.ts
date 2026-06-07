import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { DataBackupInfo, DataRestoreResult } from '@subscription-tracker/types';
import { PrismaService } from '../prisma/prisma.service';
import { getBackupDirectory, getSqliteFilePath } from './sqlite-path.util';

const SQLITE_MAGIC = 'SQLite format 3';
const BACKUP_PREFIX = 'subsync-backup-';
const BACKUP_SUFFIX = '.db';

@Injectable()
export class DataBackupService {
  constructor(private readonly prisma: PrismaService) {}

  listBackups(): DataBackupInfo[] {
    const backupDir = getBackupDirectory();
    if (!existsSync(backupDir)) {
      return [];
    }

    return readdirSync(backupDir)
      .filter((name) => name.startsWith(BACKUP_PREFIX) && name.endsWith(BACKUP_SUFFIX))
      .map((fileName) => {
        const filePath = join(backupDir, fileName);
        const stats = statSync(filePath);
        return {
          fileName,
          filePath,
          sizeBytes: stats.size,
          createdAt: stats.mtime.toISOString(),
        };
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async createBackup(): Promise<DataBackupInfo> {
    const databasePath = getSqliteFilePath();
    if (!existsSync(databasePath)) {
      throw new NotFoundException(`Database file not found at ${databasePath}`);
    }

    const backupDir = getBackupDirectory();
    mkdirSync(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${BACKUP_PREFIX}${timestamp}${BACKUP_SUFFIX}`;
    const filePath = join(backupDir, fileName);

    copyFileSync(databasePath, filePath);
    const stats = statSync(filePath);

    return {
      fileName,
      filePath,
      sizeBytes: stats.size,
      createdAt: stats.mtime.toISOString(),
    };
  }

  getBackupFilePath(fileName: string): string {
    this.assertSafeBackupFileName(fileName);
    const filePath = join(getBackupDirectory(), fileName);
    if (!existsSync(filePath)) {
      throw new NotFoundException(`Backup "${fileName}" not found`);
    }
    return filePath;
  }

  async restoreFromBackupFile(fileName: string): Promise<DataRestoreResult> {
    const filePath = this.getBackupFilePath(fileName);
    const buffer = readFileSync(filePath);
    return this.restoreFromBuffer(buffer, fileName);
  }

  async restoreFromBuffer(
    buffer: Buffer,
    sourceName = 'uploaded-backup.db',
  ): Promise<DataRestoreResult> {
    this.assertSqliteBackup(buffer);

    const safetyBackup = await this.createBackup();
    const databasePath = getSqliteFilePath();

    await this.prisma.$disconnect();
    try {
      writeFileSync(databasePath, buffer);
    } finally {
      await this.prisma.$connect();
    }

    return {
      restoredAt: new Date().toISOString(),
      sourceName,
      safetyBackupFileName: safetyBackup.fileName,
      message:
        'Database restored successfully. A safety backup of the previous database was saved locally.',
    };
  }

  private assertSqliteBackup(buffer: Buffer): void {
    const header = buffer.subarray(0, SQLITE_MAGIC.length).toString('utf8');
    if (header !== SQLITE_MAGIC) {
      throw new BadRequestException('Invalid SQLite backup file.');
    }
  }

  private assertSafeBackupFileName(fileName: string): void {
    if (
      !fileName.startsWith(BACKUP_PREFIX) ||
      !fileName.endsWith(BACKUP_SUFFIX) ||
      fileName.includes('..') ||
      fileName.includes('/') ||
      fileName.includes('\\')
    ) {
      throw new BadRequestException('Invalid backup file name.');
    }
  }
}
