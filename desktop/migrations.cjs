const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const LEDGER_TABLE = '_migrations';

function listMigrations(migrationsDir) {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      file: resolve(migrationsDir, entry.name, 'migration.sql'),
    }))
    .filter((migration) => existsSync(migration.file))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function tableExists(db, tableName) {
  const row = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    )
    .get(tableName);
  return row !== undefined;
}

function columnExists(db, tableName, columnName) {
  return db
    .prepare(`PRAGMA table_info("${tableName}")`)
    .all()
    .some((column) => column.name === columnName);
}

// Pre-ledger databases (installed before the _migrations table existed) already
// contain some or all of the schema, so re-running a migration verbatim can hit
// non-idempotent statements. SQLite has no ADD COLUMN IF NOT EXISTS, so skip
// column additions that already happened; CREATE statements in the historical
// migration set are all IF NOT EXISTS and re-run safely.
function execGuarded(db, sql) {
  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    const alterMatch = statement.match(
      /^ALTER\s+TABLE\s+"?([A-Za-z0-9_]+)"?\s+ADD\s+COLUMN\s+"?([A-Za-z0-9_]+)"?/i,
    );
    if (alterMatch && columnExists(db, alterMatch[1], alterMatch[2])) {
      continue;
    }
    db.exec(`${statement};`);
  }
}

function applyMigrations(databasePath, migrationsDir) {
  const migrations = listMigrations(migrationsDir);
  if (migrations.length === 0) {
    throw new Error(`No SQLite migrations found in ${migrationsDir}.`);
  }

  const db = new DatabaseSync(databasePath);
  try {
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(
      `CREATE TABLE IF NOT EXISTS "${LEDGER_TABLE}" (
        "name" TEXT NOT NULL PRIMARY KEY,
        "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`,
    );

    const applied = new Set(
      db
        .prepare(`SELECT name FROM "${LEDGER_TABLE}"`)
        .all()
        .map((row) => row.name),
    );
    const isPreLedgerDatabase =
      applied.size === 0 && tableExists(db, 'Subscription');
    const recordApplied = db.prepare(
      `INSERT INTO "${LEDGER_TABLE}" ("name") VALUES (?)`,
    );

    for (const migration of migrations) {
      if (applied.has(migration.name)) {
        continue;
      }

      const sql = readFileSync(migration.file, 'utf8');
      db.exec('BEGIN');
      try {
        if (isPreLedgerDatabase) {
          execGuarded(db, sql);
        } else {
          db.exec(sql);
        }
        recordApplied.run(migration.name);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw new Error(
          `Failed to apply migration ${migration.name}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          { cause: error },
        );
      }
    }
  } finally {
    db.close();
  }

  return databasePath;
}

module.exports = { applyMigrations };
