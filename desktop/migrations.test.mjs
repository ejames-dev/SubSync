import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, describe, it } from 'node:test';
import { applyMigrations } from './migrations.cjs';

const realMigrationsDir = resolve(import.meta.dirname, '../apps/api/prisma/migrations');
const tempRoot = mkdtempSync(join(tmpdir(), 'subsync-migrations-'));
let databaseCounter = 0;

after(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

function newDatabasePath() {
  databaseCounter += 1;
  return join(tempRoot, `test-${databaseCounter}.db`);
}

function listRealMigrations() {
  return readdirSync(realMigrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function withDb(databasePath, callback) {
  const db = new DatabaseSync(databasePath);
  try {
    return callback(db);
  } finally {
    db.close();
  }
}

function tableNames(db) {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => row.name);
}

function columnNames(db, table) {
  return db.prepare(`PRAGMA table_info("${table}")`).all().map((row) => row.name);
}

function ledgerNames(db) {
  return db.prepare('SELECT name FROM "_migrations" ORDER BY name').all().map((row) => row.name);
}

describe('applyMigrations', () => {
  it('initializes a fresh database with the full schema and ledger', () => {
    const databasePath = newDatabasePath();
    applyMigrations(databasePath, realMigrationsDir);

    withDb(databasePath, (db) => {
      const tables = tableNames(db);
      for (const table of [
        'Service',
        'Subscription',
        'NotificationPreference',
        'SubscriptionEvent',
        'UserSettings',
        'IntegrationConnection',
        'GmailConnection',
        'PendingNotification',
        '_migrations',
      ]) {
        assert.ok(tables.includes(table), `missing table ${table}`);
      }

      const subscriptionColumns = columnNames(db, 'Subscription');
      for (const column of ['nextRenewalReminderSent', 'statusChangedAt', 'snoozedUntil']) {
        assert.ok(subscriptionColumns.includes(column), `missing Subscription.${column}`);
      }
      assert.ok(columnNames(db, 'Service').includes('logoUrl'));

      assert.deepEqual(ledgerNames(db), listRealMigrations());
    });
  });

  it('is idempotent across relaunches', () => {
    const databasePath = newDatabasePath();
    applyMigrations(databasePath, realMigrationsDir);
    applyMigrations(databasePath, realMigrationsDir);
    applyMigrations(databasePath, realMigrationsDir);

    withDb(databasePath, (db) => {
      assert.deepEqual(ledgerNames(db), listRealMigrations());
    });
  });

  it('baselines a fully migrated pre-ledger database without re-running DDL', () => {
    const databasePath = newDatabasePath();

    // Simulate a v1.1.x install: every migration applied in dependency order,
    // no ledger table.
    withDb(databasePath, (db) => {
      db.exec('PRAGMA foreign_keys = ON;');
      const ordered = [
        '20260317174500_init_sqlite',
        '20260317175000_notifications',
        '20260317180000_subscription_events',
        '20260317183000_user_settings',
        '20260317193000_integration_connections',
        '20260605120000_gmail_oauth',
        '20260605140000_pending_notifications',
        '20260605200000_service_logo_url',
        '20260605201000_subscription_snooze',
      ];
      assert.deepEqual(ordered, listRealMigrations());
      for (const name of ordered) {
        db.exec(readFileSync(join(realMigrationsDir, name, 'migration.sql'), 'utf8'));
      }
      db.prepare(
        'INSERT INTO "Service" ("id", "name", "category") VALUES (?, ?, ?)',
      ).run('svc_netflix', 'Netflix', 'video');
    });

    applyMigrations(databasePath, realMigrationsDir);
    applyMigrations(databasePath, realMigrationsDir);

    withDb(databasePath, (db) => {
      assert.deepEqual(ledgerNames(db), listRealMigrations());
      // Existing data must survive the baseline.
      const service = db.prepare('SELECT name FROM "Service" WHERE id = ?').get('svc_netflix');
      assert.equal(service.name, 'Netflix');
    });
  });

  it('upgrades a partially migrated pre-ledger database', () => {
    const databasePath = newDatabasePath();

    // Simulate a v1.0.x install: only the five pre-Gmail migrations applied.
    withDb(databasePath, (db) => {
      db.exec('PRAGMA foreign_keys = ON;');
      for (const name of [
        '20260317174500_init_sqlite',
        '20260317175000_notifications',
        '20260317180000_subscription_events',
        '20260317183000_user_settings',
        '20260317193000_integration_connections',
      ]) {
        db.exec(readFileSync(join(realMigrationsDir, name, 'migration.sql'), 'utf8'));
      }
    });

    applyMigrations(databasePath, realMigrationsDir);

    withDb(databasePath, (db) => {
      assert.ok(tableNames(db).includes('GmailConnection'));
      assert.ok(columnNames(db, 'Service').includes('logoUrl'));
      assert.ok(columnNames(db, 'Subscription').includes('snoozedUntil'));
      assert.deepEqual(ledgerNames(db), listRealMigrations());
    });
  });

  it('rolls back a failing migration without recording it', () => {
    const syntheticDir = join(tempRoot, 'synthetic-migrations');
    mkdirSync(join(syntheticDir, '001_ok'), { recursive: true });
    mkdirSync(join(syntheticDir, '002_broken'), { recursive: true });
    writeFileSync(
      join(syntheticDir, '001_ok', 'migration.sql'),
      'CREATE TABLE "Alpha" ("id" TEXT PRIMARY KEY);',
    );
    writeFileSync(
      join(syntheticDir, '002_broken', 'migration.sql'),
      'CREATE TABLE "Beta" ("id" TEXT PRIMARY KEY);\nALTER TABLE "Missing" ADD COLUMN "x" TEXT;',
    );

    const databasePath = newDatabasePath();
    assert.throws(
      () => applyMigrations(databasePath, syntheticDir),
      /002_broken/,
    );

    withDb(databasePath, (db) => {
      const tables = tableNames(db);
      assert.ok(tables.includes('Alpha'));
      assert.ok(!tables.includes('Beta'), 'failed migration left partial schema');
      assert.deepEqual(ledgerNames(db), ['001_ok']);
    });
  });

  it('throws when the migrations directory is empty', () => {
    const emptyDir = join(tempRoot, 'empty-migrations');
    mkdirSync(emptyDir, { recursive: true });
    assert.throws(() => applyMigrations(newDatabasePath(), emptyDir), /No SQLite migrations/);
  });
});
