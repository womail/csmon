/** Instance feed catalog on disk — merged over shipped \`lib/intel-feeds.ts\` at runtime. */
import "server-only";

import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db";
import { INTEL_FEEDS, type IntelFeed, type IntelPack } from "./intel-feeds";

export const FEED_OVERRIDES_SCHEMA = "csmon-feed-overrides/1";

export type FeedOverridesFile = {
  schema: typeof FEED_OVERRIDES_SCHEMA;
  updatedAt: string;
  readme?: string;
  feeds: IntelFeed[];
};

function dataDir() {
  return process.env.CSMON_DATA_DIR?.trim() || path.join(process.cwd(), "data");
}

export function feedOverridesPath() {
  return path.join(dataDir(), "overrides", "feeds.json");
}

function parseFeed(raw: unknown): IntelFeed | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as IntelFeed;
  if (!row.id?.trim() || !row.name?.trim() || !row.url?.trim() || !row.feedUrl?.trim()) return null;
  const pack = row.pack as IntelPack;
  const packs: IntelPack[] = ["core", "relief", "security", "hazard", "tech", "markets", "sports"];
  return {
    id: row.id.trim(),
    name: row.name.trim(),
    url: row.url.trim(),
    feedUrl: row.feedUrl.trim(),
    pack: packs.includes(pack) ? pack : "core",
    blurb: row.blurb?.trim() || row.name.trim(),
  };
}

export function loadFeedOverridesFile(): FeedOverridesFile | null {
  const file = feedOverridesPath();
  try {
    const text = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(text) as FeedOverridesFile;
    const feeds = (parsed.feeds ?? []).map(parseFeed).filter(Boolean) as IntelFeed[];
    return {
      schema: FEED_OVERRIDES_SCHEMA,
      updatedAt: parsed.updatedAt ?? "",
      readme: parsed.readme,
      feeds,
    };
  } catch {
    return null;
  }
}

/** Shipped intel feeds with instance overrides applied (override wins by \`id\`). */
export function mergedIntelFeeds(): IntelFeed[] {
  const byId = new Map<string, IntelFeed>(INTEL_FEEDS.map((feed) => [feed.id, feed]));
  const file = loadFeedOverridesFile();
  for (const feed of file?.feeds ?? []) {
    byId.set(feed.id, feed);
  }
  const order = new Map(INTEL_FEEDS.map((feed, index) => [feed.id, index]));
  return [...byId.values()].sort((a, b) => {
    const ai = order.get(a.id) ?? 9999;
    const bi = order.get(b.id) ?? 9999;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
}

export function intelFeedById(id: string): IntelFeed | null {
  return mergedIntelFeeds().find((feed) => feed.id === id) ?? null;
}

export function intelFeedByUrl(feedUrl: string): IntelFeed | null {
  const key = feedUrl.trim();
  return mergedIntelFeeds().find((feed) => feed.feedUrl === key) ?? null;
}

/** Persist intel-linked DB layers into \`data/overrides/feeds.json\`. */
export function snapshotIntelOverridesFromDb(): IntelFeed[] {
  const db = getDb();
  const knownIds = new Set(mergedIntelFeeds().map((feed) => feed.id));
  const shippedIds = new Set(INTEL_FEEDS.map((feed) => feed.id));
  const rows = db
    .prepare(
      `SELECT s.handle, s.name, s.url, s.feed_url, s.description
       FROM sources s
       INNER JOIN source_origins o ON o.source_id = s.id AND o.reason = 'intel'`,
    )
    .all() as {
    handle: string | null;
    name: string;
    url: string;
    feed_url: string | null;
    description: string | null;
  }[];

  const out: IntelFeed[] = [];
  for (const row of rows) {
    const id = row.handle?.trim();
    if (!id || (!shippedIds.has(id) && !knownIds.has(id))) continue;
    const base = intelFeedById(id) ?? INTEL_FEEDS.find((feed) => feed.id === id);
    if (!row.feed_url?.trim()) continue;
    out.push({
      id,
      name: row.name.trim(),
      url: row.url.trim(),
      feedUrl: row.feed_url.trim(),
      pack: base?.pack ?? "core",
      blurb: row.description?.trim() || base?.blurb || row.name.trim(),
    });
  }
  const seen = new Set<string>();
  return out.filter((feed) => {
    if (seen.has(feed.id)) return false;
    seen.add(feed.id);
    return true;
  });
}

export function saveFeedOverrides(feeds: IntelFeed[]): FeedOverridesFile {
  const dir = path.dirname(feedOverridesPath());
  fs.mkdirSync(dir, { recursive: true });
  const body: FeedOverridesFile = {
    schema: FEED_OVERRIDES_SCHEMA,
    updatedAt: new Date().toISOString(),
    readme:
      "Instance overrides for intel RSS feeds. Merged over lib/intel-feeds.ts at runtime. Export to git separately if you want upstream defaults to change.",
    feeds,
  };
  fs.writeFileSync(feedOverridesPath(), `${JSON.stringify(body, null, 2)}\n`, "utf8");
  return body;
}

export function feedOverrideStats() {
  const file = loadFeedOverridesFile();
  return {
    path: feedOverridesPath(),
    count: file?.feeds.length ?? 0,
    updatedAt: file?.updatedAt ?? null,
    shippedCount: INTEL_FEEDS.length,
    effectiveCount: mergedIntelFeeds().length,
  };
}
