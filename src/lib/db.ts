import { existsSync, readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

const DB_PATH = join(process.cwd(), "data", "postmark.db");
const MIGRATION_PATH = join(process.cwd(), "db", "migrations", "001_initial.sql");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  mkdirSync(dirname(DB_PATH), { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  try {
    sqliteVec.load(db);
  } catch (err) {
    throw new Error(
      `Failed to load sqlite-vec extension. The prebuilt binary may be missing for this platform. Original error: ${(err as Error).message}`,
    );
  }

  applyInitialMigrationIfNeeded(db);

  _db = db;
  return db;
}

function applyInitialMigrationIfNeeded(db: Database.Database): void {
  const row = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'experiments'",
    )
    .get() as { name: string } | undefined;

  if (row) return;

  if (!existsSync(MIGRATION_PATH)) {
    throw new Error(`Initial migration not found at ${MIGRATION_PATH}`);
  }

  const sql = readFileSync(MIGRATION_PATH, "utf8");

  const runMigration = db.transaction(() => {
    db.exec(sql);
  });

  try {
    runMigration();
  } catch (err) {
    throw new Error(
      `Initial migration failed; database is unchanged. Original error: ${(err as Error).message}`,
    );
  }
}
