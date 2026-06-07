import { resolve } from 'node:path';

export function getSqliteFilePath(
  databaseUrl = process.env.DATABASE_URL,
): string {
  const url = databaseUrl?.trim() || 'file:./dev.db';
  const rawPath = url.startsWith('file:') ? url.slice('file:'.length) : url;
  return resolve(process.cwd(), rawPath);
}

export function getBackupDirectory(
  databaseUrl = process.env.DATABASE_URL,
): string {
  const configured = process.env.BACKUP_DIR?.trim();
  if (configured) {
    return resolve(process.cwd(), configured);
  }

  const databasePath = getSqliteFilePath(databaseUrl);
  return resolve(databasePath, '..', 'backups');
}
