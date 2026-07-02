import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyMigrations } from '../../../desktop/migrations.cjs';

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

applyMigrations(databasePath, migrationsDir);

console.log(`Initialized SQLite database at ${databasePath}`);
