import "server-only";
import { getDb } from "./db";

export type CacheKind = "html" | "json" | "rss" | "kev" | "translate" | "live";

/** Expired bodies are kept this long so the next fetch can revalidate with ETag / Last-Modified. */
const STALE_KEEP_MS = 3 * 24 * 60 * 60 * 1000;

export type CacheValidators = { etag?: string | null; lastModified?: string | null };

export type CacheEntry = {
  body: string;
  fresh: boolean;
  etag: string | null;
  lastModified: string | null;
};

function purgeStale(now: number) {
  getDb().prepare("DELETE FROM fetch_cache WHERE expires_at < ?").run(now - STALE_KEEP_MS);
}

export function cacheGet(key: string): string | null {
  const now = Date.now();
  purgeStale(now);
  const row = getDb()
    .prepare("SELECT body FROM fetch_cache WHERE cache_key = ? AND expires_at > ?")
    .get(key, now) as { body: string } | undefined;
  return row?.body ?? null;
}

/** Fresh or stale row plus its validators. */
export function cacheGetEntry(key: string): CacheEntry | null {
  const now = Date.now();
  purgeStale(now);
  const row = getDb()
    .prepare("SELECT body, expires_at, etag, last_modified FROM fetch_cache WHERE cache_key = ?")
    .get(key) as
    | { body: string; expires_at: number; etag: string | null; last_modified: string | null }
    | undefined;
  if (!row) return null;
  return {
    body: row.body,
    fresh: Number(row.expires_at) > now,
    etag: row.etag ?? null,
    lastModified: row.last_modified ?? null,
  };
}

/** Last stored body even when TTL expired — used when GDELT rate-limits a refresh. */
export function cacheGetStale(key: string): string | null {
  const row = getDb()
    .prepare("SELECT body FROM fetch_cache WHERE cache_key = ?")
    .get(key) as { body: string } | undefined;
  return row?.body ?? null;
}

export function cacheSet(
  key: string,
  kind: CacheKind,
  body: string,
  ttlMs: number,
  validators?: CacheValidators,
) {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO fetch_cache (cache_key, kind, body, fetched_at, expires_at, etag, last_modified)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         kind = excluded.kind,
         body = excluded.body,
         fetched_at = excluded.fetched_at,
         expires_at = excluded.expires_at,
         etag = excluded.etag,
         last_modified = excluded.last_modified`,
    )
    .run(key, kind, body, now, now + ttlMs, validators?.etag ?? null, validators?.lastModified ?? null);
}

/** Upstream said 304: keep the body, extend its life. */
export function cacheTouch(key: string, ttlMs: number) {
  const now = Date.now();
  getDb()
    .prepare("UPDATE fetch_cache SET fetched_at = ?, expires_at = ? WHERE cache_key = ?")
    .run(now, now + ttlMs, key);
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

/**
 * Expire outbound cache so Refresh re-fetches RSS/JSON/KEV/HTML (not translate). Rows stay so the
 * next request can be conditional. GDELT DOC lists stay fresh.
 */
export function cacheClearForRefresh() {
  getDb()
    .prepare(
      `UPDATE fetch_cache SET expires_at = MIN(expires_at, ?)
       WHERE kind IN ('rss', 'json', 'kev', 'html', 'live')
         AND cache_key NOT LIKE 'json:https://api.gdeltproject.org/%'
         AND cache_key NOT LIKE 'meta:%'`,
    )
    .run(Date.now() - 1);
}
