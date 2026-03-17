import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const prismaDir = resolve(import.meta.dirname, '../prisma');
const migrationsDir = resolve(prismaDir, 'migrations');
const databaseUrl = process.env.DATABASE_URL ?? 'file:./dev.db';

if (!databaseUrl.startsWith('file:')) {
  throw new Error(
    `SQLite bootstrap requires DATABASE_URL to use the file: scheme. Received "${databaseUrl}".`,
  );
}

const databasePath = resolve(prismaDir, databaseUrl.slice('file:'.length));
mkdirSync(resolve(databasePath, '..'), { recursive: true });

const migrationFiles = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => resolve(migrationsDir, entry.name, 'migration.sql'))
  .filter((migrationPath) => existsSync(migrationPath))
  .sort();

if (migrationFiles.length === 0) {
  throw new Error(`No SQLite migrations found in ${migrationsDir}.`);
}

const db = new DatabaseSync(databasePath);
db.exec('PRAGMA foreign_keys = ON;');

for (const migrationFile of migrationFiles) {
  db.exec(readFileSync(migrationFile, 'utf8'));
}

db.close();

console.log(`Initialized SQLite database at ${databasePath}`);
