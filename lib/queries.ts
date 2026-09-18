import { colorFor } from "./colors";
import { getDb } from "./db";
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
  fetched_at: number;
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
    origins,
  };
}

function mapItem(row: ItemRow): Item {
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags) as string[];
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    sourceId: row.source_id,
    externalId: row.external_id,
    title: row.title,
    summary: row.summary,
    url: row.url,
    author: row.author,
    publishedAt: row.published_at,
    tags,
    fetchedAt: row.fetched_at,
  };
}

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
        `UPDATE sources SET name = ?, handle = ?, url = ?, feed_url = COALESCE(?, feed_url),
         description = COALESCE(?, description), avatar_url = COALESCE(?, avatar_url)
         WHERE id = ?`,
      ).run(
        source.name,
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
    insertItems(self.id, result.items);
    db.prepare("UPDATE sources SET last_fetched_at = ? WHERE id = ?").run(
      now,
      self.id,
    );
  }

  return { userId, sources: listSources() };
}

export function insertItems(sourceId: number, items: ScrapedItem[]) {
  const db = getDb();
  const now = Date.now();
  const stmt = db.prepare(
    `INSERT INTO items
     (source_id, external_id, title, summary, url, author, published_at, tags, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(source_id, external_id) DO UPDATE SET
       title = excluded.title,
       summary = excluded.summary,
       url = excluded.url,
       author = excluded.author,
       published_at = excluded.published_at,
       tags = excluded.tags,
       fetched_at = excluded.fetched_at`,
  );
  for (const item of items) {
    stmt.run(
      sourceId,
      item.externalId,
      item.title,
      item.summary,
      item.url,
      item.author,
      item.publishedAt,
      JSON.stringify(item.tags),
      now,
    );
  }
}

export function setSourceEnabled(ids: number[], enabled: boolean) {
  if (ids.length === 0) return;
  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  db.prepare(
    `UPDATE sources SET enabled = ? WHERE id IN (${placeholders})`,
  ).run(enabled ? 1 : 0, ...ids);
}

export function markFetched(sourceId: number) {
  getDb()
    .prepare("UPDATE sources SET last_fetched_at = ? WHERE id = ?")
    .run(Date.now(), sourceId);
}

export function deleteSource(id: number) {
  const db = getDb();
  db.prepare("DELETE FROM items WHERE source_id = ?").run(id);
  db.prepare("DELETE FROM source_origins WHERE source_id = ?").run(id);
  db.prepare("DELETE FROM sources WHERE id = ?").run(id);
}

export function listSources(): Source[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM sources ORDER BY name").all() as SourceRow[];
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

export function listEnabledSources() {
  return listSources().filter((source) => source.enabled);
}

export function getSource(id: number) {
  return listSources().find((source) => source.id === id) ?? null;
}

export function listUsers(): SeedUser[] {
  return getDb()
    .prepare("SELECT * FROM seed_users ORDER BY last_scraped_at DESC")
    .all()
    .map((row) => mapUser(row as Record<string, unknown>));
}

export function listItems(limit = 500): Item[] {
  return (
    getDb()
      .prepare(
        `SELECT items.* FROM items
         JOIN sources ON sources.id = items.source_id
         WHERE sources.enabled = 1
         ORDER BY COALESCE(items.published_at, items.fetched_at) DESC
         LIMIT ?`,
      )
      .all(limit) as ItemRow[]
  ).map(mapItem);
}

export function getMonitorState(): MonitorState {
  return {
    users: listUsers(),
    sources: listSources(),
    items: listItems(),
  };
}
