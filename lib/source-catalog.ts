/** Source library: catalog rows, manual layers, retention purge, bulk import. */
import "server-only";

import { colorFor } from "./colors";
import { INTEL_FEEDS } from "./intel-feeds";
import { getDb } from "./db";
import type {
  CreateSourceInput,
  SourceCatalog,
  SourceCatalogRow,
  SourcePatch,
} from "./source-catalog-shared";
import type { OriginReason, Platform, SourceKind } from "./types";

export type { SourceCatalog, SourceCatalogRow, SourceCatalogSummary, SourcePatch } from "./source-catalog-shared";

const DAY_MS = 24 * 60 * 60 * 1000;

const feedByUrl = new Map(INTEL_FEEDS.map((feed) => [feed.feedUrl, feed]));
const feedById = new Map(INTEL_FEEDS.map((feed) => [feed.id, feed]));

function primaryReason(origins: SourceCatalogRow["origins"]): OriginReason | "unknown" {
  if (!origins.length) return "unknown";
  const ranked = [...origins].sort((a, b) => b.weight - a.weight);
  return ranked[0]?.reason ?? "unknown";
}

export function buildSourceCatalog(options?: {
  purgePreviewDays?: number;
  defaultRetentionDays?: number | null;
  previewSourceIds?: number[];
}): SourceCatalog {
  const db = getDb();
  const now = Date.now();
  const since = now - DAY_MS;

  const sources = db.prepare("SELECT * FROM sources ORDER BY name").all() as {
    id: number;
    key: string;
    name: string;
    handle: string | null;
    url: string;
    feed_url: string | null;
    platform: string;
    kind: string;
    description: string | null;
    enabled: number;
    last_fetched_at: number | null;
    created_at: number;
    retention_days: number | null;
  }[];

  const stats = db
    .prepare(
      `SELECT source_id,
              COUNT(*) AS item_count,
              SUM(CASE WHEN fetched_at >= ? THEN 1 ELSE 0 END) AS items_last_24h,
              MAX(COALESCE(published_at, fetched_at)) AS latest_item_at
       FROM items
       GROUP BY source_id`,
    )
    .all(since) as {
    source_id: number;
    item_count: number;
    items_last_24h: number;
    latest_item_at: number | null;
  }[];

  const latestTitles = db
    .prepare(
      `SELECT i.source_id, i.title
       FROM items i
       INNER JOIN (
         SELECT source_id, MAX(COALESCE(published_at, fetched_at)) AS ts
         FROM items GROUP BY source_id
       ) m ON m.source_id = i.source_id
       AND COALESCE(i.published_at, i.fetched_at) = m.ts`,
    )
    .all() as { source_id: number; title: string }[];

  const statBySource = new Map(stats.map((row) => [row.source_id, row]));
  const titleBySource = new Map(latestTitles.map((row) => [row.source_id, row.title]));

  const originsRaw = db
    .prepare(
      `SELECT o.source_id, o.reason, o.weight, u.handle AS seed_handle
       FROM source_origins o
       JOIN seed_users u ON u.id = o.seed_user_id`,
    )
    .all() as {
    source_id: number;
    reason: OriginReason;
    weight: number;
    seed_handle: string;
  }[];

  const originsBySource = new Map<number, SourceCatalogRow["origins"]>();
  for (const row of originsRaw) {
    const list = originsBySource.get(row.source_id) ?? [];
    list.push({ reason: row.reason, weight: row.weight, seedHandle: row.seed_handle });
    originsBySource.set(row.source_id, list);
  }

  const rows: SourceCatalogRow[] = sources.map((row) => {
    const stat = statBySource.get(row.id);
    const itemCount = Number(stat?.item_count ?? 0);
    const itemsLast24h = Number(stat?.items_last_24h ?? 0);
    const lastFetchedAt = row.last_fetched_at;
    const enabled = row.enabled === 1;
    const stale =
      enabled &&
      (lastFetchedAt == null || lastFetchedAt < since) &&
      row.platform === "rss";
    const silent = enabled && itemCount === 0;
    const feedUrl = row.feed_url;
    const intelFeed =
      (feedUrl && feedByUrl.get(feedUrl)) ||
      (row.handle && feedById.get(row.handle)) ||
      null;
    const origins = originsBySource.get(row.id) ?? [];

    return {
      id: row.id,
      key: row.key,
      name: row.name,
      handle: row.handle,
      url: row.url,
      feedUrl,
      platform: row.platform as Platform,
      kind: row.kind as SourceKind,
      description: row.description,
      enabled,
      lastFetchedAt,
      createdAt: row.created_at,
      retentionDays: row.retention_days != null ? Number(row.retention_days) : null,
      origins,
      intelFeed,
      itemCount,
      itemsLast24h,
      latestItemAt: stat?.latest_item_at ?? null,
      latestTitle: titleBySource.get(row.id) ?? null,
      stale,
      silent,
      primaryReason: primaryReason(origins),
    };
  });

  const enabled = rows.filter((row) => row.enabled).length;
  const stale = rows.filter((row) => row.stale).length;
  const silent = rows.filter((row) => row.silent).length;
  const itemsLast24h = rows.reduce((sum, row) => sum + row.itemsLast24h, 0);
  const notInShippedCatalog = rows.filter(
    (row) => row.feedUrl && row.platform === "rss" && !row.intelFeed,
  ).length;

  const suggestions: string[] = [];
  if (silent > 0) {
    suggestions.push(
      `${silent} enabled layer${silent === 1 ? "" : "s"} never returned items — check feed URLs or disable them to speed refresh.`,
    );
  }
  if (stale > 0) {
    suggestions.push(
      `${stale} RSS layer${stale === 1 ? "" : "s"} not fetched in 24h — run Refresh or fix outbound network from the host.`,
    );
  }
  if (notInShippedCatalog > 0) {
    suggestions.push(
      `${notInShippedCatalog} custom/explored RSS feed${notInShippedCatalog === 1 ? "" : "s"} — export your edits and open a GitHub PR to add them to lib/intel-feeds.ts for other installs.`,
    );
  }
  const lowSignal = rows.filter((row) => row.enabled && row.itemsLast24h === 0 && row.itemCount > 0);
  if (lowSignal.length >= 3) {
    suggestions.push(
      `${lowSignal.length} enabled sources had no items in the last 24h — consider narrowing packs or disabling quiet layers.`,
    );
  }

  let purgePreviewCount: number | undefined;
  const previewDays = options?.purgePreviewDays;
  if (previewDays != null && previewDays > 0) {
    purgePreviewCount = countItemsOlderThan(
      previewDays,
      options?.previewSourceIds,
    );
  }

  return {
    rows,
    summary: {
      total: rows.length,
      enabled,
      stale,
      silent,
      itemsLast24h,
      notInShippedCatalog,
      suggestions,
      purgePreviewCount,
    },
    shippedFeedCount: INTEL_FEEDS.length,
  };
}

export function countItemsOlderThan(maxAgeDays: number, sourceIds?: number[]) {
  const cutoff = Date.now() - maxAgeDays * DAY_MS;
  const db = getDb();
  if (sourceIds?.length) {
    const placeholders = sourceIds.map(() => "?").join(",");
    const row = db
      .prepare(
        `SELECT COUNT(*) AS n FROM items
         WHERE source_id IN (${placeholders})
         AND COALESCE(published_at, fetched_at) < ?`,
      )
      .get(...sourceIds, cutoff) as { n: number };
    return Number(row.n);
  }
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM items WHERE COALESCE(published_at, fetched_at) < ?`,
    )
    .get(cutoff) as { n: number };
  return Number(row.n);
}

/** Uses each source's retention_days, falling back to globalDefaultDays when unset. */
export function purgeByRetentionPolicy(
  globalDefaultDays: number | null,
  sourceIds?: number[],
): number {
  if (globalDefaultDays == null || globalDefaultDays <= 0) return 0;
  const db = getDb();
  const now = Date.now();
  const sources = db.prepare("SELECT id, retention_days FROM sources").all() as {
    id: number;
    retention_days: number | null;
  }[];
  let deleted = 0;
  const del = db.prepare(
    `DELETE FROM items WHERE source_id = ? AND COALESCE(published_at, fetched_at) < ?`,
  );
  for (const source of sources) {
    if (sourceIds?.length && !sourceIds.includes(source.id)) continue;
    const days = source.retention_days ?? globalDefaultDays;
    if (days == null || days <= 0) continue;
    const cutoff = now - days * DAY_MS;
    const result = del.run(source.id, cutoff);
    deleted += Number(result.changes);
  }
  return deleted;
}

export function purgeItemsOlderThan(maxAgeDays: number, sourceIds?: number[]) {
  const cutoff = Date.now() - maxAgeDays * DAY_MS;
  const db = getDb();
  if (sourceIds?.length) {
    const placeholders = sourceIds.map(() => "?").join(",");
    const result = db
      .prepare(
        `DELETE FROM items WHERE source_id IN (${placeholders})
         AND COALESCE(published_at, fetched_at) < ?`,
      )
      .run(...sourceIds, cutoff);
    return Number(result.changes);
  }
  const result = db
    .prepare(`DELETE FROM items WHERE COALESCE(published_at, fetched_at) < ?`)
    .run(cutoff);
  return Number(result.changes);
}

function manualSeedUserId() {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM seed_users WHERE handle = ? AND platform = ?")
    .get("manual-sources", "rss") as { id: number } | undefined;
  if (existing) return existing.id;
  const now = Date.now();
  const inserted = db
    .prepare(
      `INSERT INTO seed_users
       (handle, platform, did, display_name, avatar_url, description, profile_url, last_scraped_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "manual-sources",
      "rss",
      null,
      "Manual RSS layers",
      null,
      "Added from source library",
      "https://localhost/manual",
      now,
      now,
    );
  return Number(inserted.lastInsertRowid);
}

export function importManualSources(
  inputs: CreateSourceInput[],
): { ids: number[]; created: number; skipped: number; errors: string[] } {
  const ids: number[] = [];
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];
  const db = getDb();
  for (const input of inputs) {
    try {
      const feedUrl = input.feedUrl.trim();
      const key = `rss:${feedUrl}`;
      const existing = db.prepare("SELECT id FROM sources WHERE key = ?").get(key) as
        | { id: number }
        | undefined;
      if (existing) {
        skipped += 1;
        ids.push(existing.id);
        continue;
      }
      const id = createManualSource(input);
      created += 1;
      ids.push(id);
    } catch (err) {
      errors.push(
        `${input.name || input.feedUrl}: ${err instanceof Error ? err.message : "failed"}`,
      );
    }
  }
  return { ids, created, skipped, errors };
}

export function createManualSource(input: CreateSourceInput): number {
  const db = getDb();
  const now = Date.now();
  const feedUrl = input.feedUrl.trim();
  const key = `rss:${feedUrl}`;
  const existing = db.prepare("SELECT id FROM sources WHERE key = ?").get(key) as
    | { id: number }
    | undefined;
  if (existing) return existing.id;

  const inserted = db
    .prepare(
      `INSERT INTO sources
       (key, name, handle, url, feed_url, platform, kind, description, avatar_url, color, enabled, created_at, retention_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      key,
      input.name.trim(),
      "manual",
      input.url.trim(),
      feedUrl,
      "rss",
      "feed",
      input.description?.trim() || "Added from source library",
      null,
      colorFor(key),
      input.enabled !== false ? 1 : 0,
      now,
      input.retentionDays ?? null,
    );
  const id = Number(inserted.lastInsertRowid);
  const seedId = manualSeedUserId();
  db.prepare(
    `INSERT INTO source_origins (source_id, seed_user_id, reason, weight)
     VALUES (?, ?, ?, ?)`,
  ).run(id, seedId, "self", 80);
  return id;
}

export function patchSources(updates: SourcePatch[]) {
  const db = getDb();
  const get = db.prepare("SELECT * FROM sources WHERE id = ?");
  const update = db.prepare(
    `UPDATE sources SET name = ?, handle = ?, url = ?, feed_url = ?, description = ?, enabled = ?, retention_days = ?, key = ? WHERE id = ?`,
  );
  for (const patch of updates) {
    if (!Number.isInteger(patch.id) || patch.id <= 0) continue;
    const current = get.get(patch.id) as {
      id: number;
      key: string;
      name: string;
      handle: string | null;
      url: string;
      feed_url: string | null;
      description: string | null;
      enabled: number;
      retention_days: number | null;
    } | undefined;
    if (!current) continue;

    const name = patch.name !== undefined ? patch.name.trim() : current.name;
    const url = patch.url !== undefined ? patch.url.trim() : current.url;
    const feedUrl = patch.feedUrl !== undefined ? patch.feedUrl : current.feed_url;
    const description =
      patch.description !== undefined ? patch.description : current.description;
    const enabled =
      patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : current.enabled;
    const retentionDays =
      patch.retentionDays !== undefined ? patch.retentionDays : current.retention_days;

    let key = current.key;
    let handle = current.handle;
    if (feedUrl && feedUrl !== current.feed_url) {
      key = `rss:${feedUrl}`;
      const clash = db
        .prepare("SELECT id FROM sources WHERE key = ? AND id != ?")
        .get(key, patch.id) as { id: number } | undefined;
      if (clash) {
        throw new Error(`Another layer already uses this feed URL.`);
      }
    }

    update.run(name, handle, url, feedUrl, description, enabled, retentionDays, key, patch.id);
  }
}
