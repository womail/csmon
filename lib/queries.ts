import "server-only";

import { cacheStats } from "./cache";
import { applySourceTopics, applyWeatherSourceTopics, classifyItem } from "./classify";
import { colorFor } from "./colors";
import { getDb, withTransaction } from "./db";
import { entitiesForItemIds, indexItemEntities } from "./entities";
import { extractSnippet, searchItemIds, upsertItemFts } from "./evidence";
import { hintSources } from "./explore";
import { parseQueryLine } from "./query-builder";
import { listWatchlists, notifyWatchAlerts, recordWatchHits, type WatchAlert } from "./watchlists";
import { type IntelFeed } from "./intel-feeds";
import { repairRssFeedUrl } from "./feed-url-repair";
import { acledFeedUrl, acledSourceKey, normalizeAcledProfiles, type AcledProfile } from "./acled";
import { gdeltDocUrl, gdeltSearchText, gdeltSourceKey, normalizeGdeltQueries, type GdeltQuery } from "./gdelt";
import {
  REDDIT_SOURCE_KEY,
  combinedRedditRssUrl,
  redditListingUrl,
  redditOAuthFeedUrl,
  uniqueSubreddits,
} from "./reddit";
import { scoreKev, type KevEntry } from "./kev";
import type {
  DiscoveredSource,
  Item,
  MonitorState,
  OriginReason,
  Platform,
  ScrapeResult,
  ScrapedItem,
  SeedUser,
  Source,
  SourceFetchStatus,
  SourceKind,
} from "./types";

type SourceRow = {
  id: number;
  key: string;
  name: string;
  handle: string | null;
  url: string;
  feed_url: string | null;
  platform: string;
  kind: string;
  description: string | null;
  avatar_url: string | null;
  color: string;
  enabled: number;
  last_fetched_at: number | null;
  created_at: number;
  retention_days?: number | null;
  last_status?: string | null;
  last_error?: string | null;
  fail_count?: number | null;
  next_fetch_at?: number | null;
  last_added?: number | null;
};

type ItemRow = {
  id: number;
  source_id: number;
  external_id: string;
  title: string;
  summary: string | null;
  url: string;
  author: string | null;
  published_at: number | null;
  tags: string;
  topics?: string;
  locations?: string;
  fetched_at: number;
  extract_body?: string | null;
  extract_at?: number | null;
};

function mapUser(row: Record<string, unknown>): SeedUser {
  return {
    id: Number(row.id),
    handle: String(row.handle),
    platform: row.platform as Platform,
    did: row.did ? String(row.did) : null,
    displayName: row.display_name ? String(row.display_name) : null,
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    description: row.description ? String(row.description) : null,
    profileUrl: String(row.profile_url),
    lastScrapedAt: row.last_scraped_at ? Number(row.last_scraped_at) : null,
    createdAt: Number(row.created_at),
  };
}

function mapSource(
  row: SourceRow,
  origins: Source["origins"],
): Source {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    handle: row.handle,
    url: row.url,
    feedUrl: row.feed_url,
    platform: row.platform as Platform,
    kind: row.kind as SourceKind,
    description: row.description,
    avatarUrl: row.avatar_url,
    color: row.color,
    enabled: row.enabled === 1,
    lastFetchedAt: row.last_fetched_at,
    createdAt: row.created_at,
    retentionDays:
      row.retention_days === undefined || row.retention_days === null
        ? null
        : Number(row.retention_days),
    origins,
    health: {
      status: (row.last_status as SourceFetchStatus | null | undefined) ?? null,
      error: row.last_error ?? null,
      failCount: Number(row.fail_count ?? 0),
      nextFetchAt: row.next_fetch_at ?? null,
      lastAdded: row.last_added ?? null,
    },
  };
}

function parseJsonArray(raw: string | undefined) {
  if (!raw) return [] as string[];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

function mapItem(row: ItemRow, entities?: Item["entities"]): Item {
  const topics = parseJsonArray(row.topics);
  const locations = parseJsonArray(row.locations);
  const tags = parseJsonArray(row.tags);
  const classified =
    topics.length || locations.length || tags.length ? null : classifyItem(row.title, row.summary);
  const extractText = extractSnippet(row.extract_body);
  return {
    id: row.id,
    sourceId: row.source_id,
    externalId: row.external_id,
    title: row.title,
    summary: row.summary,
    url: row.url,
    author: row.author,
    publishedAt: row.published_at,
    tags: tags.length ? tags : (classified?.tags ?? []),
    topics: topics.length ? topics : (classified?.topics ?? []),
    locations: locations.length ? locations : (classified?.locations ?? []),
    fetchedAt: row.fetched_at,
    extractText,
    extractAt: row.extract_at ?? null,
    iocs: entities?.filter((row) => row.kind === "ioc").map((row) => row.label),
    entities,
  };
}

function hydrateItems(rows: ItemRow[]): Item[] {
  const entities = entitiesForItemIds(rows.map((row) => row.id));
  return rows.map((row) => mapItem(row, entities.get(row.id)));
}

const ITEM_SELECT = `SELECT items.*, extracts.body AS extract_body, extracts.extracted_at AS extract_at
  FROM items
  LEFT JOIN extracts ON extracts.item_id = items.id`;

export function upsertScrape(result: ScrapeResult) {
  const db = getDb();
  const now = Date.now();

  const existingUser = db
    .prepare(
      "SELECT * FROM seed_users WHERE handle = ? AND platform = ?",
    )
    .get(result.user.handle, result.user.platform) as
    | Record<string, unknown>
    | undefined;

  let userId: number;
  if (existingUser) {
    userId = Number(existingUser.id);
    db.prepare(
      `UPDATE seed_users
       SET did = ?, display_name = ?, avatar_url = ?, description = ?,
           profile_url = ?, last_scraped_at = ?
       WHERE id = ?`,
    ).run(
      result.user.did,
      result.user.displayName,
      result.user.avatarUrl,
      result.user.description,
      result.user.profileUrl,
      now,
      userId,
    );
  } else {
    const inserted = db
      .prepare(
        `INSERT INTO seed_users
         (handle, platform, did, display_name, avatar_url, description, profile_url, last_scraped_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        result.user.handle,
        result.user.platform,
        result.user.did,
        result.user.displayName,
        result.user.avatarUrl,
        result.user.description,
        result.user.profileUrl,
        now,
        now,
      );
    userId = Number(inserted.lastInsertRowid);
  }

  const sourceIds: { source: DiscoveredSource; id: number }[] = [];

  for (const source of result.sources) {
    const current = db
      .prepare("SELECT * FROM sources WHERE key = ?")
      .get(source.key) as SourceRow | undefined;

    let id: number;
    if (current) {
      id = current.id;
      db.prepare(
        `UPDATE sources SET handle = ?, url = ?, feed_url = COALESCE(?, feed_url),
         description = COALESCE(?, description), avatar_url = COALESCE(?, avatar_url)
         WHERE id = ?`,
      ).run(
        source.handle,
        source.url,
        source.feedUrl,
        source.description,
        source.avatarUrl,
        id,
      );
    } else {
      const enabled = source.reason === "self" ? 1 : 0;
      const inserted = db
        .prepare(
          `INSERT INTO sources
           (key, name, handle, url, feed_url, platform, kind, description, avatar_url, color, enabled, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          source.key,
          source.name,
          source.handle,
          source.url,
          source.feedUrl,
          source.platform,
          source.kind,
          source.description,
          source.avatarUrl,
          colorFor(source.key),
          enabled,
          now,
        );
      id = Number(inserted.lastInsertRowid);
    }

    db.prepare(
      `INSERT INTO source_origins (source_id, seed_user_id, reason, weight)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(source_id, seed_user_id, reason)
       DO UPDATE SET weight = MAX(weight, excluded.weight)`,
    ).run(id, userId, source.reason, source.weight);

    sourceIds.push({ source, id });
  }

  const self = sourceIds.find((s) => s.source.reason === "self");
  if (self && result.items.length) {
    const ingested = insertItems(self.id, result.items);
    db.prepare("UPDATE sources SET last_fetched_at = ? WHERE id = ?").run(
      now,
      self.id,
    );
    void notifyWatchAlerts(ingested.alerts);
  }

  return { userId, sources: listSources() };
}

export function insertItems(
  sourceId: number,
  items: ScrapedItem[],
): { ids: number[]; created: number; alerts: WatchAlert[] } {
  if (!items.length) return { ids: [], created: 0, alerts: [] };
  const db = getDb();
  const now = Date.now();
  const exists = db.prepare("SELECT 1 FROM items WHERE source_id = ? AND external_id = ?");
  let created = 0;
  const stmt = db.prepare(
    `INSERT INTO items
     (source_id, external_id, title, summary, url, author, published_at, tags, topics, locations, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(source_id, external_id) DO UPDATE SET
       title = excluded.title,
       summary = excluded.summary,
       url = excluded.url,
       author = excluded.author,
       published_at = COALESCE(excluded.published_at, items.published_at),
       tags = excluded.tags,
       topics = excluded.topics,
       locations = excluded.locations,
       fetched_at = excluded.fetched_at
     RETURNING id`,
  );
  const source = getSource(sourceId);
  const indexed: { id: number; scraped: ScrapedItem }[] = [];
  withTransaction(() => {
    for (const item of items) {
      let classified = classifyItem(item.title, item.summary);
      classified = applySourceTopics(classified, {
        handle: source?.handle,
        feedUrl: source?.feedUrl,
      });
      classified = applyWeatherSourceTopics(
        classified,
        { handle: source?.handle, feedUrl: source?.feedUrl },
        `${item.title} ${item.summary ?? ""} ${item.url ?? ""}`,
      );
      const topics = item.topics.length ? item.topics : classified.topics;
      const tags = item.tags.length ? item.tags : classified.tags;
      if (!exists.get(sourceId, item.externalId)) created += 1;
      const row = stmt.get(
        sourceId,
        item.externalId,
        item.title,
        item.summary,
        item.url,
        item.author,
        item.publishedAt,
        JSON.stringify(tags),
        JSON.stringify(topics),
        JSON.stringify(item.locations.length ? item.locations : classified.locations),
        now,
      ) as { id: number } | undefined;
      if (!row) continue;
      const existing = db.prepare("SELECT body FROM extracts WHERE item_id = ?").get(row.id) as
        | { body: string }
        | undefined;
      upsertItemFts(row.id, item.title, item.summary, existing?.body ?? "");
      indexItemEntities(row.id, `${item.title}\n${item.summary ?? ""}`, item);
      indexed.push({ id: row.id, scraped: item });
    }
  });
  const watches = listWatchlists();
  const alerts: WatchAlert[] = [];
  for (const row of indexed) {
    const mapped: Item = {
      id: row.id,
      sourceId,
      externalId: row.scraped.externalId,
      title: row.scraped.title,
      summary: row.scraped.summary,
      url: row.scraped.url,
      author: row.scraped.author,
      publishedAt: row.scraped.publishedAt,
      tags: row.scraped.tags,
      topics: row.scraped.topics,
      locations: row.scraped.locations,
      fetchedAt: now,
    };
    alerts.push(...recordWatchHits(mapped, source ?? undefined, watches));
  }
  return { ids: indexed.map((row) => row.id), created, alerts };
}

export function retireRedditRssSource(sourceId: number, detail: string) {
  const description = `Reddit RSS ended — layer disabled. ${detail}`.replace(/\s+/g, " ").slice(0, 240);
  getDb().prepare("UPDATE sources SET enabled = 0, description = ? WHERE id = ?").run(description, sourceId);
}

export function setSourceEnabled(ids: number[], enabled: boolean) {
  if (ids.length === 0) return;
  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  db.prepare(
    `UPDATE sources SET enabled = ? WHERE id IN (${placeholders})`,
  ).run(enabled ? 1 : 0, ...ids);
}

export function recordFetchSuccess(
  sourceId: number,
  status: Exclude<SourceFetchStatus, "error">,
  added: number,
  nextFetchAt: number,
) {
  getDb()
    .prepare(
      `UPDATE sources SET last_fetched_at = ?, last_status = ?, last_error = NULL, fail_count = 0,
         last_added = ?, next_fetch_at = ? WHERE id = ?`,
    )
    .run(Date.now(), status, added, nextFetchAt, sourceId);
}

export function recordFetchFailure(sourceId: number, message: string, nextFetchAt: (failCount: number) => number) {
  const db = getDb();
  const row = db.prepare("SELECT fail_count FROM sources WHERE id = ?").get(sourceId) as
    | { fail_count: number | null }
    | undefined;
  const failCount = Number(row?.fail_count ?? 0) + 1;
  db.prepare(
    `UPDATE sources SET last_status = 'error', last_error = ?, fail_count = ?, next_fetch_at = ? WHERE id = ?`,
  ).run(message.slice(0, 300), failCount, nextFetchAt(failCount), sourceId);
}

export function deferSources(ids: number[], until: number) {
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  getDb()
    .prepare(`UPDATE sources SET next_fetch_at = ? WHERE id IN (${placeholders})`)
    .run(until, ...ids);
}

/**
 * Enabled layers whose scheduler slot has come round. Never-scheduled layers count as due once
 * their last fetch is older than `unscheduledAfterMs`, so a restart does not refetch everything.
 */
export function listDueSources(now = Date.now(), unscheduledAfterMs = 15 * 60 * 1000) {
  return attachOrigins(
    getDb()
      .prepare(
        `SELECT * FROM sources WHERE enabled = 1 AND (
           next_fetch_at <= ?
           OR (next_fetch_at IS NULL AND (last_fetched_at IS NULL OR last_fetched_at <= ?))
         )
         ORDER BY COALESCE(next_fetch_at, last_fetched_at, 0)`,
      )
      .all(now, now - unscheduledAfterMs) as SourceRow[],
  );
}

/** Recent publish times for one layer, newest first — feeds adaptive polling. */
export function recentPublishTimes(sourceId: number, limit = 12): number[] {
  return (
    getDb()
      .prepare(
        `SELECT published_at FROM items WHERE source_id = ? AND published_at IS NOT NULL
         ORDER BY published_at DESC LIMIT ?`,
      )
      .all(sourceId, limit) as { published_at: number }[]
  ).map((row) => Number(row.published_at));
}

export function deleteSource(id: number) {
  const db = getDb();
  const rows = db.prepare("SELECT id FROM items WHERE source_id = ?").all(id) as { id: number }[];
  for (const row of rows) {
    try {
      db.prepare("DELETE FROM items_fts WHERE rowid = ?").run(row.id);
    } catch {
      /* FTS optional */
    }
  }
  db.prepare("DELETE FROM items WHERE source_id = ?").run(id);
  db.prepare("DELETE FROM source_origins WHERE source_id = ?").run(id);
  db.prepare("DELETE FROM sources WHERE id = ?").run(id);
}

function attachOrigins(rows: SourceRow[]): Source[] {
  if (!rows.length) return [];
  const db = getDb();
  const origins = db
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

  const bySource = new Map<number, Source["origins"]>();
  for (const origin of origins) {
    const list = bySource.get(origin.source_id) ?? [];
    list.push({
      reason: origin.reason,
      weight: origin.weight,
      seedHandle: origin.seed_handle,
    });
    bySource.set(origin.source_id, list);
  }

  return rows.map((row) => mapSource(row, bySource.get(row.id) ?? []));
}

export function listSources(): Source[] {
  return attachOrigins(getDb().prepare("SELECT * FROM sources ORDER BY name").all() as SourceRow[]);
}

export function listEnabledSources() {
  return attachOrigins(
    getDb().prepare("SELECT * FROM sources WHERE enabled = 1 ORDER BY name").all() as SourceRow[],
  );
}

export function listSourcesByIds(ids: number[]) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  return attachOrigins(
    getDb()
      .prepare(`SELECT * FROM sources WHERE id IN (${placeholders}) ORDER BY name`)
      .all(...ids) as SourceRow[],
  );
}

export function getSource(id: number) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM sources WHERE id = ?").get(id) as SourceRow | undefined;
  if (!row) return null;
  const origins = db
    .prepare(
      `SELECT o.reason, o.weight, u.handle AS seed_handle
       FROM source_origins o
       JOIN seed_users u ON u.id = o.seed_user_id
       WHERE o.source_id = ?`,
    )
    .all(id) as { reason: OriginReason; weight: number; seed_handle: string }[];
  return mapSource(
    row,
    origins.map((origin) => ({
      reason: origin.reason,
      weight: origin.weight,
      seedHandle: origin.seed_handle,
    })),
  );
}

export function listUsers(): SeedUser[] {
  return getDb()
    .prepare("SELECT * FROM seed_users ORDER BY last_scraped_at DESC")
    .all()
    .map((row) => mapUser(row as Record<string, unknown>));
}

/** Recent items from enabled sources (newest first). Limit is capped in board-limit.ts. */
export function listItems(limit = 500): Item[] {
  return hydrateItems(
    getDb()
      .prepare(
        `${ITEM_SELECT}
         JOIN sources ON sources.id = items.source_id
         WHERE sources.enabled = 1
         ORDER BY COALESCE(items.published_at, items.fetched_at) DESC
         LIMIT ?`,
      )
      .all(limit) as ItemRow[],
  );
}

export function listItemsByIds(ids: number[]): Item[] {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = getDb()
    .prepare(`${ITEM_SELECT} WHERE items.id IN (${placeholders})`)
    .all(...ids) as ItemRow[];
  const order = new Map(ids.map((id, index) => [id, index]));
  return hydrateItems(rows).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

function mergeBoardItems(recent: Item[], extra: Item[], cap: number) {
  const seen = new Set(recent.map((item) => item.id));
  const merged = [...recent];
  for (const item of extra) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged
    .sort((a, b) => (b.publishedAt ?? b.fetchedAt) - (a.publishedAt ?? a.fetchedAt))
    .slice(0, Math.max(cap, recent.length + Math.min(extra.length, 160)));
}

export function getMonitorState(itemLimit?: number, search?: string | null): MonitorState {
  const sources = listSources();
  const cap = itemLimit ?? 500;
  let items = listItems(cap);
  const parsed = parseQueryLine(search);
  const ftsNeedle = [parsed.text, ...parsed.tree.rules.map((rule) => rule.value)]
    .filter(Boolean)
    .join(" ");
  if (ftsNeedle) {
    items = mergeBoardItems(items, listItemsByIds(searchItemIds(ftsNeedle, 160)), cap);
  }
  return {
    users: listUsers(),
    sources,
    items,
    hints: hintSources(items, sources),
    kev: listKev(),
    cache: cacheStats(),
    watches: listWatchlists(),
  };
}

export function emptyMonitorState(): MonitorState {
  return {
    users: [],
    sources: [],
    items: [],
    hints: [],
    kev: [],
    cache: { entries: 0, bytes: 0 },
    watches: [],
  };
}

export function replaceKev(entries: KevEntry[]) {
  const db = getDb();
  const now = Date.now();
  const stmt = db.prepare(
    `INSERT INTO kev
     (cve_id, vendor, product, name, description, date_added, due_date, ransomware, required_action, notes, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  withTransaction(() => {
    db.exec("DELETE FROM kev");
    for (const entry of entries) {
      stmt.run(
        entry.cveId,
        entry.vendor,
        entry.product,
        entry.name,
        entry.description,
        entry.dateAdded,
        entry.dueDate,
        entry.ransomware ? 1 : 0,
        entry.requiredAction,
        entry.notes,
        now,
      );
    }
  });
}

export function listKev(): KevEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM kev ORDER BY date_added DESC, ransomware DESC LIMIT 400`,
    )
    .all() as {
    cve_id: string;
    vendor: string;
    product: string;
    name: string;
    description: string | null;
    date_added: number | null;
    due_date: number | null;
    ransomware: number;
    required_action: string | null;
    notes: string | null;
  }[];
  return rows.map((row) => {
    const ransomware = row.ransomware === 1;
    const dueDate = row.due_date ?? 0;
    return {
      cveId: row.cve_id,
      vendor: row.vendor,
      product: row.product,
      name: row.name,
      description: row.description ?? "",
      dateAdded: row.date_added ?? 0,
      dueDate,
      ransomware,
      requiredAction: row.required_action ?? "",
      notes: row.notes ?? "",
      url: `https://nvd.nist.gov/vuln/detail/${row.cve_id}`,
      ...scoreKev({ dueDate, dateAdded: row.date_added ?? 0, ransomware }),
    };
  });
}

function intelSeedUserId() {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM seed_users WHERE handle = ? AND platform = ?")
    .get("intel-pack", "rss") as { id: number } | undefined;
  if (existing) return existing.id;
  const now = Date.now();
  const inserted = db
    .prepare(
      `INSERT INTO seed_users
       (handle, platform, did, display_name, avatar_url, description, profile_url, last_scraped_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "intel-pack",
      "rss",
      null,
      "Free intel feeds",
      null,
      "Curated public RSS",
      "https://localhost/intel",
      now,
      now,
    );
  return Number(inserted.lastInsertRowid);
}

export function registerIntelFeeds(feeds: IntelFeed[], enable: boolean) {
  const db = getDb();
  const now = Date.now();
  const seedId = intelSeedUserId();
  const ids: number[] = [];
  for (const feed of feeds) {
    const feedUrl = repairRssFeedUrl(feed.feedUrl);
    const key = `rss:${feedUrl}`;
    let current = db.prepare("SELECT id FROM sources WHERE key = ?").get(key) as
      | { id: number }
      | undefined;
    if (!current) {
      current = db
        .prepare("SELECT id FROM sources WHERE handle = ? AND platform = 'rss'")
        .get(feed.id) as { id: number } | undefined;
    }
    let id: number;
    if (current) {
      id = current.id;
      db.prepare(
        `UPDATE sources SET key = ?, name = ?, handle = ?, url = ?, feed_url = ?, description = COALESCE(?, description)${
          enable ? ", enabled = 1" : ""
        } WHERE id = ?`,
      ).run(key, feed.name, feed.id, feed.url, feedUrl, feed.blurb, id);
    } else {
      const inserted = db
        .prepare(
          `INSERT INTO sources
           (key, name, handle, url, feed_url, platform, kind, description, avatar_url, color, enabled, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          key,
          feed.name,
          feed.id,
          feed.url,
          feedUrl,
          "rss",
          "feed",
          feed.blurb,
          null,
          colorFor(key),
          enable ? 1 : 0,
          now,
        );
      id = Number(inserted.lastInsertRowid);
    }
    db.prepare(
      `INSERT INTO source_origins (source_id, seed_user_id, reason, weight)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(source_id, seed_user_id, reason)
       DO UPDATE SET weight = MAX(weight, excluded.weight)`,
    ).run(id, seedId, "intel", 50);
    ids.push(id);
  }
  return ids;
}

function redditSeedUserId() {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM seed_users WHERE handle = ? AND platform = ?")
    .get("reddit-pack", "rss") as { id: number } | undefined;
  if (existing) return existing.id;
  const now = Date.now();
  const inserted = db
    .prepare(
      `INSERT INTO seed_users
       (handle, platform, did, display_name, avatar_url, description, profile_url, last_scraped_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "reddit-pack",
      "rss",
      null,
      "Reddit public RSS",
      null,
      "Combined subreddit RSS",
      "https://www.reddit.com/",
      now,
      now,
    );
  return Number(inserted.lastInsertRowid);
}

export function registerRedditFeed(subs: string[], enable: boolean, options?: { oauth?: boolean }) {
  const names = uniqueSubreddits(subs);
  const db = getDb();
  const now = Date.now();
  const seedId = redditSeedUserId();
  const key = REDDIT_SOURCE_KEY;
  const feedUrl = names.length
    ? options?.oauth
      ? redditOAuthFeedUrl(names)
      : combinedRedditRssUrl(names)
    : null;
  const url = redditListingUrl(names);
  const label = names.length
    ? `Reddit r/${names.slice(0, 3).join("+")}${names.length > 3 ? ` +${names.length - 3}` : ""}`
    : "Reddit";
  const description = names.length
    ? names.map((name) => `r/${name}`).join(", ")
    : "No subreddits selected";
  const actuallyEnable = enable && names.length > 0;
  const current = db.prepare("SELECT id FROM sources WHERE key = ?").get(key) as
    | { id: number }
    | undefined;
  let id: number;
  if (current) {
    id = current.id;
    db.prepare(
      `UPDATE sources SET name = ?, handle = ?, url = ?, feed_url = ?, description = ?, enabled = ? WHERE id = ?`,
    ).run(label, "reddit", url, feedUrl, description, actuallyEnable ? 1 : 0, id);
  } else {
    const inserted = db
      .prepare(
        `INSERT INTO sources
         (key, name, handle, url, feed_url, platform, kind, description, avatar_url, color, enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        key,
        label,
        "reddit",
        url,
        feedUrl,
        "rss",
        "feed",
        description,
        null,
        colorFor(key),
        actuallyEnable ? 1 : 0,
        now,
      );
    id = Number(inserted.lastInsertRowid);
  }
  db.prepare(
    `INSERT INTO source_origins (source_id, seed_user_id, reason, weight)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(source_id, seed_user_id, reason)
     DO UPDATE SET weight = MAX(weight, excluded.weight)`,
  ).run(id, seedId, "reddit", 50);
  return [id];
}

function gdeltSeedUserId() {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM seed_users WHERE handle = ? AND platform = ?")
    .get("gdelt", "rss") as { id: number } | undefined;
  if (existing) return existing.id;
  const now = Date.now();
  const inserted = db
    .prepare(
      `INSERT INTO seed_users
       (handle, platform, did, display_name, avatar_url, description, profile_url, last_scraped_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "gdelt",
      "rss",
      null,
      "GDELT Project",
      null,
      "DOC 2.0 article search",
      "https://www.gdeltproject.org/",
      now,
      now,
    );
  return Number(inserted.lastInsertRowid);
}

export function registerGdeltQueries(queries: GdeltQuery[]) {
  const normalized = normalizeGdeltQueries(queries);
  const db = getDb();
  const now = Date.now();
  const seedId = gdeltSeedUserId();
  const ids: number[] = [];
  const keys = new Set<string>();
  for (const query of normalized) {
    const key = gdeltSourceKey(query.id);
    keys.add(key);
    const feedUrl = gdeltDocUrl(query);
    const name = `GDELT ${query.name}`;
    const description = `${query.timespan} · ${query.maxRecords} · ${gdeltSearchText(query)}`.slice(0, 240);
    const current = db.prepare("SELECT id FROM sources WHERE key = ?").get(key) as { id: number } | undefined;
    let id: number;
    if (current) {
      id = current.id;
      db.prepare(
        `UPDATE sources SET name = ?, handle = ?, url = ?, feed_url = ?, description = ?, enabled = ? WHERE id = ?`,
      ).run(name, query.id, "https://www.gdeltproject.org/", feedUrl, description, query.enabled ? 1 : 0, id);
    } else {
      const inserted = db
        .prepare(
          `INSERT INTO sources
           (key, name, handle, url, feed_url, platform, kind, description, avatar_url, color, enabled, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          key,
          name,
          query.id,
          "https://www.gdeltproject.org/",
          feedUrl,
          "rss",
          "feed",
          description,
          null,
          colorFor(key),
          query.enabled ? 1 : 0,
          now,
        );
      id = Number(inserted.lastInsertRowid);
    }
    db.prepare(
      `INSERT INTO source_origins (source_id, seed_user_id, reason, weight)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(source_id, seed_user_id, reason)
       DO UPDATE SET weight = MAX(weight, excluded.weight)`,
    ).run(id, seedId, "gdelt", 50);
    if (query.enabled) ids.push(id);
  }
  const stale = db.prepare("SELECT id, key FROM sources WHERE key LIKE 'gdelt:%'").all() as {
    id: number;
    key: string;
  }[];
  for (const row of stale) {
    if (!keys.has(row.key)) db.prepare("UPDATE sources SET enabled = 0 WHERE id = ?").run(row.id);
  }
  return ids;
}

function acledSeedUserId() {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM seed_users WHERE handle = ? AND platform = ?")
    .get("acled", "rss") as { id: number } | undefined;
  if (existing) return existing.id;
  const now = Date.now();
  const inserted = db
    .prepare(
      `INSERT INTO seed_users
       (handle, platform, did, display_name, avatar_url, description, profile_url, last_scraped_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "acled",
      "rss",
      null,
      "ACLED",
      null,
      "Armed Conflict Location & Event Data",
      "https://acleddata.com/",
      now,
      now,
    );
  return Number(inserted.lastInsertRowid);
}

export function registerAcledProfiles(profiles: AcledProfile[]) {
  const normalized = normalizeAcledProfiles(profiles);
  const db = getDb();
  const now = Date.now();
  const seedId = acledSeedUserId();
  const ids: number[] = [];
  const keys = new Set<string>();
  for (const profile of normalized) {
    const key = acledSourceKey(profile.id);
    keys.add(key);
    const feedUrl = acledFeedUrl(profile);
    const name = `ACLED ${profile.name}`;
    const description = `${profile.days}d · limit ${profile.limit}${profile.country ? ` · ${profile.country}` : ""}`.slice(
      0,
      240,
    );
    const current = db.prepare("SELECT id FROM sources WHERE key = ?").get(key) as { id: number } | undefined;
    let id: number;
    if (current) {
      id = current.id;
      db.prepare(
        `UPDATE sources SET name = ?, handle = ?, url = ?, feed_url = ?, description = ?, enabled = ? WHERE id = ?`,
      ).run(name, profile.id, "https://acleddata.com/", feedUrl, description, profile.enabled ? 1 : 0, id);
    } else {
      const inserted = db
        .prepare(
          `INSERT INTO sources
           (key, name, handle, url, feed_url, platform, kind, description, avatar_url, color, enabled, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          key,
          name,
          profile.id,
          "https://acleddata.com/",
          feedUrl,
          "rss",
          "feed",
          description,
          null,
          colorFor(key),
          profile.enabled ? 1 : 0,
          now,
        );
      id = Number(inserted.lastInsertRowid);
    }
    db.prepare(
      `INSERT INTO source_origins (source_id, seed_user_id, reason, weight)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(source_id, seed_user_id, reason)
       DO UPDATE SET weight = MAX(weight, excluded.weight)`,
    ).run(id, seedId, "acled", 55);
    if (profile.enabled) ids.push(id);
  }
  const stale = db.prepare("SELECT id, key FROM sources WHERE key LIKE 'acled:%'").all() as {
    id: number;
    key: string;
  }[];
  for (const row of stale) {
    if (!keys.has(row.key)) db.prepare("UPDATE sources SET enabled = 0 WHERE id = ?").run(row.id);
  }
  return ids;
}

export function registerExploredSource(input: {
  name: string;
  url: string;
  feedUrl: string | null;
  host: string;
}) {
  const db = getDb();
  const now = Date.now();
  const seedId = intelSeedUserId();
  const key = input.feedUrl ? `rss:${input.feedUrl}` : `web:${input.host}`;
  const current = db.prepare("SELECT id FROM sources WHERE key = ?").get(key) as
    | { id: number }
    | undefined;
  if (current) return current.id;
  const inserted = db
    .prepare(
      `INSERT INTO sources
       (key, name, handle, url, feed_url, platform, kind, description, avatar_url, color, enabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      key,
      input.name,
      input.host,
      input.url,
      input.feedUrl,
      input.feedUrl ? "rss" : "web",
      input.feedUrl ? "feed" : "site",
      "Auto-discovered from coverage",
      null,
      colorFor(key),
      1,
      now,
    );
  const id = Number(inserted.lastInsertRowid);
  db.prepare(
    `INSERT INTO source_origins (source_id, seed_user_id, reason, weight)
     VALUES (?, ?, ?, ?)`,
  ).run(id, seedId, "explore", 20);
  return id;
}
