import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.CSMON_DATA_DIR?.trim() || path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "csmon.sqlite");

const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: "001_init",
    sql: `
      CREATE TABLE IF NOT EXISTS seed_users (
        id INTEGER PRIMARY KEY,
        handle TEXT NOT NULL,
        platform TEXT NOT NULL,
        did TEXT,
        display_name TEXT,
        avatar_url TEXT,
        description TEXT,
        profile_url TEXT NOT NULL,
        last_scraped_at INTEGER,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sources (
        id INTEGER PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        handle TEXT,
        url TEXT NOT NULL,
        feed_url TEXT,
        platform TEXT NOT NULL,
        kind TEXT NOT NULL,
        description TEXT,
        avatar_url TEXT,
        color TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0,
        last_fetched_at INTEGER,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS source_origins (
        id INTEGER PRIMARY KEY,
        source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
        seed_user_id INTEGER NOT NULL REFERENCES seed_users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        weight INTEGER NOT NULL DEFAULT 1,
        UNIQUE(source_id, seed_user_id, reason)
      );

      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY,
        source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
        external_id TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT,
        url TEXT NOT NULL,
        author TEXT,
        published_at INTEGER,
        tags TEXT NOT NULL DEFAULT '[]',
        fetched_at INTEGER NOT NULL,
        UNIQUE(source_id, external_id)
      );

      CREATE INDEX IF NOT EXISTS idx_items_published ON items(published_at DESC);
      CREATE INDEX IF NOT EXISTS idx_items_source ON items(source_id);
    `,
  },
  {
    name: "002_topics_locations",
    sql: `
      ALTER TABLE items ADD COLUMN topics TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE items ADD COLUMN locations TEXT NOT NULL DEFAULT '[]';
    `,
  },
  {
    name: "003_kev",
    sql: `
      CREATE TABLE IF NOT EXISTS kev (
        cve_id TEXT PRIMARY KEY,
        vendor TEXT NOT NULL,
        product TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        date_added INTEGER,
        due_date INTEGER,
        ransomware INTEGER NOT NULL DEFAULT 0,
        required_action TEXT,
        notes TEXT,
        fetched_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_kev_due ON kev(due_date);
      CREATE INDEX IF NOT EXISTS idx_kev_ransomware ON kev(ransomware);
    `,
  },
  {
    name: "004_fetch_cache",
    sql: `
      CREATE TABLE IF NOT EXISTS fetch_cache (
        cache_key TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        body TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_fetch_cache_expires ON fetch_cache(expires_at);
    `,
  },
  {
    name: "005_source_retention",
    sql: `ALTER TABLE sources ADD COLUMN retention_days INTEGER;`,
  },
];

const globalForDb = globalThis as unknown as { csmonDb?: DatabaseSync };

function applyMigrations(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);
  const applied = new Set(
    db
      .prepare("SELECT name FROM _migrations")
      .all()
      .map((row) => String((row as { name: string }).name)),
  );
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue;
    if (migration.name === "002_topics_locations") {
      const cols = new Set(
        (db.prepare("PRAGMA table_info(items)").all() as { name: string }[]).map(
          (row) => row.name,
        ),
      );
      if (!cols.has("topics")) {
        db.exec(`ALTER TABLE items ADD COLUMN topics TEXT NOT NULL DEFAULT '[]'`);
      }
      if (!cols.has("locations")) {
        db.exec(`ALTER TABLE items ADD COLUMN locations TEXT NOT NULL DEFAULT '[]'`);
      }
    } else if (migration.name === "005_source_retention") {
      const cols = new Set(
        (db.prepare("PRAGMA table_info(sources)").all() as { name: string }[]).map(
          (row) => row.name,
        ),
      );
      if (!cols.has("retention_days")) {
        db.exec(`ALTER TABLE sources ADD COLUMN retention_days INTEGER`);
      }
    } else {
      db.exec(migration.sql);
    }
    db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(
      migration.name,
      Date.now(),
    );
  }
}

let migrated = false;

export function getDb() {
  if (!globalForDb.csmonDb) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA synchronous = NORMAL");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("PRAGMA busy_timeout = 4000");
    globalForDb.csmonDb = db;
  }
  if (!migrated) {
    applyMigrations(globalForDb.csmonDb);
    migrated = true;
  }
  return globalForDb.csmonDb;
}

export function withTransaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const value = fn();
    db.exec("COMMIT");
    return value;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // already rolled back
    }
    throw error;
  }
}
