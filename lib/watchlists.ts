import "server-only";

import { getDb } from "./db";
import { fetchOutbound } from "./safe-url";
import { itemMatchesQuery, parseQueryLine } from "./query-builder";
import { isDeskId, type Item, type Source, type Watchlist } from "./types";

const MAX_WATCHES = 24;

export type WatchAlert = {
  watch: Watchlist;
  item: Item;
};

function mapWatch(row: {
  id: number;
  name: string;
  query: string;
  notify_url: string | null;
  desk: string | null;
  created_at: number;
  last_hit_at: number | null;
  last_ack_at: number | null;
  hit_count?: number;
  new_hits?: number;
}): Watchlist {
  return {
    id: row.id,
    name: row.name,
    query: row.query,
    notifyUrl: row.notify_url,
    desk: row.desk,
    createdAt: row.created_at,
    lastHitAt: row.last_hit_at,
    lastAckAt: row.last_ack_at,
    hitCount: Number(row.hit_count ?? 0),
    newHits: Number(row.new_hits ?? 0),
  };
}

export function listWatchlists(): Watchlist[] {
  return (
    getDb()
      .prepare(
        `SELECT w.*,
                (SELECT COUNT(*) FROM watch_hits h WHERE h.watchlist_id = w.id) AS hit_count,
                (SELECT COUNT(*) FROM watch_hits h
                 WHERE h.watchlist_id = w.id
                   AND h.hit_at > COALESCE(w.last_ack_at, 0)) AS new_hits
         FROM watchlists w
         ORDER BY COALESCE(w.last_hit_at, w.created_at) DESC`,
      )
      .all() as Parameters<typeof mapWatch>[0][]
  ).map(mapWatch);
}

export function createWatchlist(input: {
  name: string;
  query: string;
  notifyUrl?: string | null;
  desk?: string | null;
}) {
  const name = input.name.trim().slice(0, 80) || input.query.trim().slice(0, 80) || "Watch";
  const query = input.query.trim().slice(0, 400);
  if (!query) throw new Error("Watch needs a query.");
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) AS n FROM watchlists").get() as { n: number };
  if (Number(count.n) >= MAX_WATCHES) throw new Error("Watch limit reached.");
  const desk = input.desk && isDeskId(input.desk) ? input.desk : null;
  const notifyUrl = input.notifyUrl?.trim() || null;
  const inserted = db
    .prepare(
      `INSERT INTO watchlists (name, query, notify_url, desk, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(name, query, notifyUrl, desk, Date.now());
  return listWatchlists().find((row) => row.id === Number(inserted.lastInsertRowid)) ?? null;
}

export function deleteWatchlist(id: number) {
  getDb().prepare("DELETE FROM watchlists WHERE id = ?").run(id);
}

export function ackWatchlist(id: number) {
  getDb().prepare("UPDATE watchlists SET last_ack_at = ? WHERE id = ?").run(Date.now(), id);
}

export function itemMatchesWatchQuery(item: Item, query: string, source?: Source) {
  const parsed = parseQueryLine(query);
  if (parsed.text) {
    const hay = `${item.title} ${item.summary ?? ""} ${item.extractText ?? ""} ${source?.name ?? ""} ${
      item.iocs?.join(" ") ?? ""
    }`.toLowerCase();
    if (!hay.includes(parsed.text.toLowerCase())) return false;
  }
  return itemMatchesQuery(item, parsed.tree, source);
}

export function recordWatchHits(item: Item, source?: Source, watches = listWatchlists()): WatchAlert[] {
  if (!watches.length) return [];
  const db = getDb();
  const now = Date.now();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO watch_hits (watchlist_id, item_id, hit_at) VALUES (?, ?, ?)`,
  );
  const touch = db.prepare("UPDATE watchlists SET last_hit_at = ? WHERE id = ?");
  const alerts: WatchAlert[] = [];
  for (const watch of watches) {
    if (!itemMatchesWatchQuery(item, watch.query, source)) continue;
    const result = insert.run(watch.id, item.id, now);
    if (Number(result.changes) > 0) {
      touch.run(now, watch.id);
      alerts.push({ watch, item });
    }
  }
  return alerts;
}

export async function notifyWatchAlerts(alerts: WatchAlert[]) {
  for (const alert of alerts) {
    const url = alert.watch.notifyUrl?.trim();
    if (!url) continue;
    try {
      await fetchOutbound(url, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          Title: `csmon watch: ${alert.watch.name}`.slice(0, 80),
          Tags: "eyes",
        },
        body: `${alert.item.title}\n${alert.item.url}`.slice(0, 1200),
        timeoutMs: 6000,
        maxBytes: 8000,
      });
    } catch (error) {
      console.error("watch notify", error);
    }
  }
}
