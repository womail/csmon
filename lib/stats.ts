import "server-only";

import fs from "node:fs";
import { envBoardItemLimit } from "./board-limit";
import { getDb, getDataDir, getDbPath } from "./db";
import { acledConfigured, parseAcledFeedUrl } from "./acled";
import { loadAcledLastError, loadAcledProbe } from "./scrape/acled-probe";
import type { AcledLayerStats, GdeltLayerStats, IngestLayerStatus, SystemStats } from "./stats-types";

export type { AcledLayerStats, GdeltLayerStats, SystemStats } from "./stats-types";

const ACLED_TOKEN_KEY = "meta:acled:token";
const ACLED_TOKEN_EXP_KEY = "meta:acled:token_exp";

function gdeltArticleCount(body: string): number | null {
  try {
    const data = JSON.parse(body) as { articles?: unknown[] };
    return Array.isArray(data.articles) ? data.articles.length : null;
  } catch {
    return null;
  }
}

function ingestLayerStatus(row: {
  enabled: boolean;
  itemCount: number;
  lastFetchedAt: number | null;
  cacheCount: number | null;
}): IngestLayerStatus {
  if (!row.enabled) return "disabled";
  if (row.lastFetchedAt == null) return "never";
  if (row.itemCount > 0) return "data";
  if (row.cacheCount != null && row.cacheCount > 0) return "cached";
  const staleMs = 24 * 60 * 60 * 1000;
  if (row.lastFetchedAt && Date.now() - row.lastFetchedAt > staleMs && row.itemCount === 0) return "stale";
  return "empty";
}

function acledEventCount(body: string): number | null {
  try {
    const data = JSON.parse(body) as unknown[];
    return Array.isArray(data) ? data.length : null;
  } catch {
    return null;
  }
}

export function getSystemStats(): SystemStats {
  const db = getDb();
  const now = Date.now();
  const since24h = now - 24 * 60 * 60 * 1000;

  let dbBytes = 0;
  try {
    dbBytes = fs.statSync(getDbPath()).size;
  } catch {
    dbBytes = 0;
  }

  const totalsRow = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM items) AS items,
         (SELECT COUNT(*) FROM sources) AS sources,
         (SELECT COUNT(*) FROM sources WHERE enabled = 1) AS sources_enabled,
         (SELECT COUNT(*) FROM extracts) AS extracts,
         (SELECT COALESCE(SUM(LENGTH(body)), 0) FROM extracts) AS extract_bytes,
         (SELECT COUNT(*) FROM fetch_cache WHERE expires_at > ?) AS cache_entries,
         (SELECT COALESCE(SUM(LENGTH(body)), 0) FROM fetch_cache WHERE expires_at > ?) AS cache_bytes`,
    )
    .get(now, now) as {
    items: number;
    sources: number;
    sources_enabled: number;
    extracts: number;
    extract_bytes: number;
    cache_entries: number;
    cache_bytes: number;
  };

  const cacheByKind = db
    .prepare(
      `SELECT kind, COUNT(*) AS entries, COALESCE(SUM(LENGTH(body)), 0) AS bytes
       FROM fetch_cache WHERE expires_at > ?
       GROUP BY kind ORDER BY bytes DESC`,
    )
    .all(now) as { kind: string; entries: number; bytes: number }[];

  const gdeltCacheRows = db
    .prepare(
      `SELECT body, LENGTH(body) AS bytes, expires_at
       FROM fetch_cache
       WHERE expires_at > ? AND cache_key LIKE 'json:https://api.gdeltproject.org/%'`,
    )
    .all(now) as { body: string; bytes: number; expires_at: number }[];

  let gdeltCacheArticles = 0;
  for (const row of gdeltCacheRows) {
    const n = gdeltArticleCount(row.body);
    if (n != null) gdeltCacheArticles += n;
  }

  const originRows = db
    .prepare(
      `SELECT o.reason,
              COUNT(DISTINCT s.id) AS layers,
              COUNT(DISTINCT CASE WHEN s.enabled = 1 THEN s.id END) AS enabled,
              (SELECT COUNT(*) FROM items i WHERE i.source_id IN (
                 SELECT so2.source_id FROM source_origins so2 WHERE so2.reason = o.reason
              )) AS items,
              (SELECT COUNT(*) FROM items i WHERE i.source_id IN (
                 SELECT so2.source_id FROM source_origins so2 WHERE so2.reason = o.reason
              ) AND COALESCE(i.published_at, i.fetched_at) > ?) AS items_24h
       FROM source_origins o
       JOIN sources s ON s.id = o.source_id
       GROUP BY o.reason
       ORDER BY items DESC`,
    )
    .all(since24h) as {
    reason: string;
    layers: number;
    enabled: number;
    items: number;
    items_24h: number;
  }[];

  const gdeltSources = db
    .prepare(
      `SELECT id, key, name, enabled, description, feed_url, last_fetched_at
       FROM sources WHERE key LIKE 'gdelt:%' ORDER BY name`,
    )
    .all() as {
    id: number;
    key: string;
    name: string;
    enabled: number;
    description: string | null;
    feed_url: string | null;
    last_fetched_at: number | null;
  }[];

  const itemStats = db.prepare(
    `SELECT COUNT(*) AS item_count,
            SUM(CASE WHEN COALESCE(published_at, fetched_at) > ? THEN 1 ELSE 0 END) AS items_24h,
            MAX(COALESCE(published_at, fetched_at)) AS latest_at
     FROM items WHERE source_id = ?`,
  );

  const latestTitle = db.prepare(
    `SELECT title FROM items WHERE source_id = ? ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT 1`,
  );

  const cacheForFeed = db.prepare(
    `SELECT body, LENGTH(body) AS bytes, expires_at FROM fetch_cache
     WHERE cache_key = ? AND expires_at > ?`,
  );

  const gdelt: GdeltLayerStats[] = gdeltSources.map((source) => {
    const stats = itemStats.get(since24h, source.id) as
      | { item_count: number; items_24h: number; latest_at: number | null }
      | undefined;
    const titleRow = latestTitle.get(source.id) as { title: string } | undefined;
    const cacheKey = source.feed_url ? `json:${source.feed_url}` : null;
    const cache = cacheKey ? (cacheForFeed.get(cacheKey, now) as { body: string; bytes: number; expires_at: number } | undefined) : undefined;
    const cacheArticles = cache ? gdeltArticleCount(cache.body) : null;
    const itemCount = Number(stats?.item_count ?? 0);
    const itemsLast24h = Number(stats?.items_24h ?? 0);
    const enabled = source.enabled === 1;
    let query: string | null = null;
    if (source.feed_url) {
      try {
        query = new URL(source.feed_url).searchParams.get("query");
      } catch {
        query = null;
      }
    }
    if (!query && source.description) {
      const parts = source.description.split(" · ");
      query = parts.length >= 3 ? parts.slice(2).join(" · ") : source.description;
    }

    const layer: GdeltLayerStats = {
      id: source.id,
      key: source.key,
      name: source.name,
      enabled,
      query,
      itemCount,
      itemsLast24h,
      latestTitle: titleRow?.title ?? null,
      latestAt: stats?.latest_at ?? null,
      lastFetchedAt: source.last_fetched_at,
      cacheArticles,
      cacheBytes: cache?.bytes ?? null,
      cacheExpiresAt: cache?.expires_at ?? null,
      status: "empty",
    };
    layer.status = ingestLayerStatus({
      enabled,
      itemCount,
      lastFetchedAt: source.last_fetched_at,
      cacheCount: cacheArticles,
    });
    return layer;
  });

  const acledCacheRows = db
    .prepare(
      `SELECT body, LENGTH(body) AS bytes, expires_at
       FROM fetch_cache
       WHERE expires_at > ? AND cache_key LIKE 'json:acled:%'`,
    )
    .all(now) as { body: string; bytes: number; expires_at: number }[];

  let acledCacheEvents = 0;
  for (const row of acledCacheRows) {
    const n = acledEventCount(row.body);
    if (n != null) acledCacheEvents += n;
  }

  const acledMeta = db
    .prepare(`SELECT cache_key, body, expires_at FROM fetch_cache WHERE cache_key IN (?, ?)`)
    .all(ACLED_TOKEN_KEY, ACLED_TOKEN_EXP_KEY) as {
    cache_key: string;
    body: string;
    expires_at: number;
  }[];
  const tokenRow = acledMeta.find((row) => row.cache_key === ACLED_TOKEN_KEY);
  const tokenExpRow = acledMeta.find((row) => row.cache_key === ACLED_TOKEN_EXP_KEY);
  const tokenExpiresAt = tokenExpRow?.body ? Number(tokenExpRow.body) : null;
  const tokenCached = Boolean(tokenRow?.body && (tokenExpiresAt == null || tokenExpiresAt > now));

  const acledSources = db
    .prepare(
      `SELECT id, key, name, enabled, description, feed_url, last_fetched_at
       FROM sources WHERE key LIKE 'acled:%' ORDER BY name`,
    )
    .all() as {
    id: number;
    key: string;
    name: string;
    enabled: number;
    description: string | null;
    feed_url: string | null;
    last_fetched_at: number | null;
  }[];

  const acled: AcledLayerStats[] = acledSources.map((source) => {
    const stats = itemStats.get(since24h, source.id) as
      | { item_count: number; items_24h: number; latest_at: number | null }
      | undefined;
    const titleRow = latestTitle.get(source.id) as { title: string } | undefined;
    const cacheKey = source.feed_url ? `json:acled:${source.feed_url}` : null;
    const cache = cacheKey ? (cacheForFeed.get(cacheKey, now) as { body: string; bytes: number; expires_at: number } | undefined) : undefined;
    const cacheEvents = cache ? acledEventCount(cache.body) : null;
    const itemCount = Number(stats?.item_count ?? 0);
    const itemsLast24h = Number(stats?.items_24h ?? 0);
    const enabled = source.enabled === 1;
    const parsed = source.feed_url ? parseAcledFeedUrl(source.feed_url) : null;

    const layer: AcledLayerStats = {
      id: source.id,
      key: source.key,
      name: source.name,
      enabled,
      country: parsed?.country ? parsed.country : parsed ? "(global sample)" : null,
      days: parsed?.days ?? 14,
      limit: parsed?.limit ?? 100,
      itemCount,
      itemsLast24h,
      latestTitle: titleRow?.title ?? null,
      latestAt: stats?.latest_at ?? null,
      lastFetchedAt: source.last_fetched_at,
      cacheEvents,
      cacheBytes: cache?.bytes ?? null,
      cacheExpiresAt: cache?.expires_at ?? null,
      status: "empty",
    };
    layer.status = ingestLayerStatus({
      enabled,
      itemCount,
      lastFetchedAt: source.last_fetched_at,
      cacheCount: cacheEvents,
    });
    return layer;
  });

  const gdeltItems = gdelt.reduce((sum, row) => sum + row.itemCount, 0);
  const gdeltItemsLast24h = gdelt.reduce((sum, row) => sum + row.itemsLast24h, 0);
  const acledItems = acled.reduce((sum, row) => sum + row.itemCount, 0);
  const acledItemsLast24h = acled.reduce((sum, row) => sum + row.itemsLast24h, 0);

  return {
    generatedAt: now,
    dataDir: getDataDir(),
    dbBytes,
    boardItemLimit: envBoardItemLimit(),
    totals: {
      items: Number(totalsRow.items),
      sources: Number(totalsRow.sources),
      sourcesEnabled: Number(totalsRow.sources_enabled),
      extracts: Number(totalsRow.extracts),
      extractBytes: Number(totalsRow.extract_bytes),
      cacheEntries: Number(totalsRow.cache_entries),
      cacheBytes: Number(totalsRow.cache_bytes),
      gdeltLayers: gdelt.length,
      gdeltItems,
      gdeltItemsLast24h,
      acledLayers: acled.length,
      acledItems,
      acledItemsLast24h,
    },
    cacheByKind: cacheByKind.map((row) => ({
      kind: row.kind,
      entries: Number(row.entries),
      bytes: Number(row.bytes),
    })),
    gdeltCache: {
      entries: gdeltCacheRows.length,
      bytes: gdeltCacheRows.reduce((sum, row) => sum + Number(row.bytes), 0),
      articles: gdeltCacheArticles,
    },
    acledCache: {
      entries: acledCacheRows.length,
      bytes: acledCacheRows.reduce((sum, row) => sum + Number(row.bytes), 0),
      events: acledCacheEvents,
    },
    acledAuth: {
      configured: acledConfigured(),
      tokenCached,
      tokenExpiresAt: tokenExpiresAt && Number.isFinite(tokenExpiresAt) ? tokenExpiresAt : null,
      lastError: loadAcledLastError(),
      probe: (() => {
        const probe = loadAcledProbe();
        if (!probe) return null;
        const { configured: _c, ...rest } = probe;
        return rest;
      })(),
    },
    origins: originRows.map((row) => ({
      reason: row.reason,
      layers: Number(row.layers),
      enabled: Number(row.enabled),
      items: Number(row.items),
      itemsLast24h: Number(row.items_24h),
    })),
    gdelt,
    acled,
    advisoryProbes: [],
  };
}
