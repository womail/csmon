import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "data", "csmon.sqlite");

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
];

const globalForDb = globalThis as unknown as { csmonDb?: DatabaseSync };

export function getDb() {
  if (globalForDb.csmonDb) return globalForDb.csmonDb;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
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
    db.exec(migration.sql);
    db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(
      migration.name,
      Date.now(),
    );
  }

  globalForDb.csmonDb = db;
  return db;
}
