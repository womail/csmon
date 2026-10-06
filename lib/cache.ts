import "server-only";
import { getDb } from "./db";

export type CacheKind = "html" | "json" | "rss" | "kev" | "translate" | "live";

export function cacheGet(key: string): string | null {
  const db = getDb();
  const now = Date.now();
  db.prepare("DELETE FROM fetch_cache WHERE expires_at < ?").run(now);
  const row = db
    .prepare("SELECT body FROM fetch_cache WHERE cache_key = ? AND expires_at > ?")
    .get(key, now) as { body: string } | undefined;
  return row?.body ?? null;
}

/** Last stored body even when TTL expired — used when GDELT rate-limits a refresh. */
export function cacheGetStale(key: string): string | null {
  const row = getDb()
    .prepare("SELECT body FROM fetch_cache WHERE cache_key = ?")
    .get(key) as { body: string } | undefined;
  return row?.body ?? null;
}

export function cacheSet(key: string, kind: CacheKind, body: string, ttlMs: number) {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO fetch_cache (cache_key, kind, body, fetched_at, expires_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         kind = excluded.kind,
         body = excluded.body,
         fetched_at = excluded.fetched_at,
         expires_at = excluded.expires_at`,
    )
    .run(key, kind, body, now, now + ttlMs);
}

export function cacheStats() {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(body)), 0) AS bytes
       FROM fetch_cache WHERE expires_at > ?`,
    )
    .get(Date.now()) as { n: number; bytes: number };
  return { entries: Number(row.n), bytes: Number(row.bytes) };
}

export const TTL = {
  rss: 15 * 60 * 1000,
  kev: 60 * 60 * 1000,
  html: 6 * 60 * 60 * 1000,
  json: 30 * 60 * 1000,
  translate: 7 * 24 * 60 * 60 * 1000,
  live: 20 * 1000,
};

/** Drop outbound cache so Refresh re-fetches RSS/JSON/KEV/HTML (not translate). GDELT DOC lists stay cached. */
export function cacheClearForRefresh() {
  getDb()
    .prepare(
      `DELETE FROM fetch_cache
       WHERE kind IN ('rss', 'json', 'kev', 'html', 'live')
         AND cache_key NOT LIKE 'json:https://api.gdeltproject.org/%'
         AND cache_key NOT LIKE 'meta:%'`,
    )
    .run();
}
