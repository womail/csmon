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
  {
    name: "006_evidence",
    sql: `
      CREATE TABLE IF NOT EXISTS extracts (
        item_id INTEGER PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        title TEXT,
        description TEXT,
        body TEXT NOT NULL,
        quotes TEXT NOT NULL DEFAULT '[]',
        language TEXT,
        cves TEXT NOT NULL DEFAULT '[]',
        extracted_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS entities (
        id INTEGER PRIMARY KEY,
        kind TEXT NOT NULL,
        key TEXT NOT NULL,
        label TEXT NOT NULL,
        extra TEXT,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        UNIQUE(kind, key)
      );

      CREATE TABLE IF NOT EXISTS item_entities (
        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        PRIMARY KEY (item_id, entity_id)
      );

      CREATE INDEX IF NOT EXISTS idx_item_entities_entity ON item_entities(entity_id);
      CREATE INDEX IF NOT EXISTS idx_entities_kind ON entities(kind, last_seen DESC);

      CREATE TABLE IF NOT EXISTS watchlists (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        query TEXT NOT NULL,
        notify_url TEXT,
        desk TEXT,
        created_at INTEGER NOT NULL,
        last_hit_at INTEGER,
        last_ack_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS watch_hits (
        id INTEGER PRIMARY KEY,
        watchlist_id INTEGER NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        hit_at INTEGER NOT NULL,
        UNIQUE(watchlist_id, item_id)
      );

      CREATE INDEX IF NOT EXISTS idx_watch_hits_item ON watch_hits(item_id);

      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS report_stories (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
        position INTEGER NOT NULL,
        snapshot TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_report_stories_report ON report_stories(report_id, position);
      CREATE INDEX IF NOT EXISTS idx_report_stories_item ON report_stories(item_id);
    `,
  },
  {
    name: "007_fetch_health",
    sql: "",
  },
];

const FETCH_HEALTH_COLUMNS: { table: string; column: string; ddl: string }[] = [
  { table: "fetch_cache", column: "etag", ddl: "etag TEXT" },
  { table: "fetch_cache", column: "last_modified", ddl: "last_modified TEXT" },
  { table: "sources", column: "last_status", ddl: "last_status TEXT" },
  { table: "sources", column: "last_error", ddl: "last_error TEXT" },
  { table: "sources", column: "fail_count", ddl: "fail_count INTEGER NOT NULL DEFAULT 0" },
  { table: "sources", column: "next_fetch_at", ddl: "next_fetch_at INTEGER" },
  { table: "sources", column: "last_added", ddl: "last_added INTEGER" },
];

function addColumnIfMissing(db: DatabaseSync, table: string, column: string, ddl: string) {
  const cols = new Set(
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((row) => row.name),
  );
  if (!cols.has(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

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
    } else if (migration.name === "007_fetch_health") {
      ensureFetchHealthColumns(db);
    } else {
      db.exec(migration.sql);
    }
    if (migration.name === "006_evidence") {
      ensureItemsFts(db);
    }
    db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(
      migration.name,
      Date.now(),
    );
  }
  if (applied.has("006_evidence")) {
    ensureItemsFts(db);
  }
  if (applied.has("007_fetch_health")) {
    ensureFetchHealthColumns(db);
  }
}

function ensureFetchHealthColumns(db: DatabaseSync) {
  for (const row of FETCH_HEALTH_COLUMNS) addColumnIfMissing(db, row.table, row.column, row.ddl);
  db.exec("CREATE INDEX IF NOT EXISTS idx_sources_next_fetch ON sources(enabled, next_fetch_at)");
}

function ensureItemsFts(db: DatabaseSync) {
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
        title,
        summary,
        body,
        tokenize = 'unicode61 remove_diacritics 2'
      );
    `);
  } catch (error) {
    console.error("items_fts unavailable", error);
    return;
  }
  const count = db.prepare("SELECT COUNT(*) AS n FROM items_fts").get() as { n: number };
  if (Number(count.n) > 0) return;
  const rows = db
    .prepare(
      `SELECT items.id, items.title, items.summary, extracts.body AS body
       FROM items
       LEFT JOIN extracts ON extracts.item_id = items.id`,
    )
    .all() as { id: number; title: string; summary: string | null; body: string | null }[];
  const insert = db.prepare("INSERT INTO items_fts(rowid, title, summary, body) VALUES (?, ?, ?, ?)");
  db.exec("BEGIN");
  try {
    for (const row of rows) {
      insert.run(row.id, row.title, row.summary ?? "", row.body ?? "");
    }
    db.exec("COMMIT");
  } catch {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
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

export function getDataDir() {
  return DATA_DIR;
}

export function getDbPath() {
  return DB_PATH;
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
