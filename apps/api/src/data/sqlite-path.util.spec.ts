import { getBackupDirectory, getSqliteFilePath } from './sqlite-path.util';

describe('sqlite-path.util', () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousBackupDir = process.env.BACKUP_DIR;

  afterEach(() => {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }

    if (previousBackupDir === undefined) {
      delete process.env.BACKUP_DIR;
    } else {
      process.env.BACKUP_DIR = previousBackupDir;
    }
  });

  it('resolves sqlite file paths from DATABASE_URL', () => {
    process.env.DATABASE_URL = 'file:./dev.db';
    expect(getSqliteFilePath()).toContain('dev.db');
  });

  it('places backups next to the database by default', () => {
    process.env.DATABASE_URL = 'file:./dev.db';
    expect(getBackupDirectory()).toContain('backups');
  });
});
