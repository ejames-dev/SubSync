import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataBackupService } from './data-backup.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DataBackupService', () => {
  const previousBackupDir = process.env.BACKUP_DIR;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  let workDir: string;
  let service: DataBackupService;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'subsync-backup-test-'));
    process.env.BACKUP_DIR = join(workDir, 'backups');
    mkdirSync(process.env.BACKUP_DIR, { recursive: true });
    writeFileSync(
      join(process.env.BACKUP_DIR, 'subsync-backup-2026-01-01.db'),
      'fake-backup-contents',
    );
    service = new DataBackupService({} as PrismaService);
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
    if (previousBackupDir === undefined) {
      delete process.env.BACKUP_DIR;
    } else {
      process.env.BACKUP_DIR = previousBackupDir;
    }
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  it('resolves a legitimate backup file name inside the backup directory', () => {
    const filePath = service.getBackupFilePath('subsync-backup-2026-01-01.db');
    expect(filePath).toBe(
      join(process.env.BACKUP_DIR as string, 'subsync-backup-2026-01-01.db'),
    );
  });

  it('rejects a traversal attempt disguised as a valid-looking name', () => {
    expect(() =>
      service.getBackupFilePath('subsync-backup-../../../etc/passwd.db'),
    ).toThrow(BadRequestException);
  });

  it('rejects a name containing a path separator', () => {
    expect(() =>
      service.getBackupFilePath('subsync-backup-sibling.db/../evil.db'),
    ).toThrow(BadRequestException);
  });

  it('throws NotFoundException for a well-formed name that does not exist', () => {
    expect(() =>
      service.getBackupFilePath('subsync-backup-missing.db'),
    ).toThrow(NotFoundException);
  });

  it('strips Gmail tokens and OAuth state from a restored database', async () => {
    const databasePath = join(workDir, 'live.db');
    writeFileSync(databasePath, 'current-database');
    process.env.DATABASE_URL = `file:${databasePath}`;

    const prisma = {
      $disconnect: jest.fn().mockResolvedValue(undefined),
      $connect: jest.fn().mockResolvedValue(undefined),
      gmailConnection: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      oAuthState: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const restoreService = new DataBackupService(prisma as never);

    // Minimal buffer that passes the SQLite header validation: 100-byte
    // header, magic string, and a valid page size (1024) at offset 16.
    const backup = Buffer.alloc(2048);
    backup.write('SQLite format 3\0', 0, 'utf8');
    backup.writeUInt16BE(1024, 16);

    const result = await restoreService.restoreFromBuffer(
      backup,
      'uploaded.db',
    );

    expect(prisma.gmailConnection.deleteMany).toHaveBeenCalledWith({});
    expect(prisma.oAuthState.deleteMany).toHaveBeenCalledWith({});
    expect(result.message).toContain('reconnect Gmail');
  });
});
