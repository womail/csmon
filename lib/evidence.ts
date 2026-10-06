import "server-only";

import type { ArticleRead } from "./article";
import { classify } from "./classify";
import { getDb } from "./db";
import { indexItemEntities } from "./entities";
import { canonUrl } from "./link";
import { cveIdsFromText } from "./nvd";
import { normalizePublishMs } from "./publish-date";

export const EXTRACT_SNIPPET_MAX = 2500;

export const PROTECTED_ITEM_SQL = `id NOT IN (
  SELECT item_id FROM report_stories WHERE item_id IS NOT NULL
  UNION
  SELECT item_id FROM watch_hits
)`;

function urlsForLookup(url: string) {
  const raw = url.trim();
  const canon = canonUrl(raw);
  return [...new Set([raw, canon, raw.replace(/\/$/, ""), canon.replace(/\/$/, "")])];
}

export function upsertItemFts(itemId: number, title: string, summary: string | null, body = "") {
  const db = getDb();
  try {
    db.prepare("DELETE FROM items_fts WHERE rowid = ?").run(itemId);
    db.prepare("INSERT INTO items_fts(rowid, title, summary, body) VALUES (?, ?, ?, ?)").run(
      itemId,
      title,
      summary ?? "",
      body,
    );
  } catch {
    /* FTS optional */
  }
}

export function deleteItemFts(itemId: number) {
  try {
    getDb().prepare("DELETE FROM items_fts WHERE rowid = ?").run(itemId);
  } catch {
    /* ignore */
  }
}

/** Quote tokens so MATCH cannot be used as an FTS operator injection. */
export function ftsMatchQuery(raw: string) {
  const words = raw
    .replace(/["']/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}.+/-]/gu, ""))
    .filter((word) => word.length > 1)
    .slice(0, 8);
  if (!words.length) return "";
  return words.map((word) => `"${word}"`).join(" AND ");
}

export function searchItemIds(raw: string, limit = 160): number[] {
  const match = ftsMatchQuery(raw);
  if (!match) return [];
  try {
    return (
      getDb()
        .prepare(
          `SELECT rowid AS id FROM items_fts WHERE items_fts MATCH ? ORDER BY rank LIMIT ?`,
        )
        .all(match, limit) as { id: number }[]
    ).map((row) => Number(row.id));
  } catch {
    return [];
  }
}

export function findItemIdsByUrl(url: string): number[] {
  const urls = urlsForLookup(url);
  if (!urls.length) return [];
  const placeholders = urls.map(() => "?").join(",");
  return (
    getDb()
      .prepare(`SELECT id FROM items WHERE url IN (${placeholders})`)
      .all(...urls) as { id: number }[]
  ).map((row) => Number(row.id));
}

function quotesJson(article: ArticleRead) {
  return JSON.stringify((article.quotes ?? []).slice(0, 8));
}

function cvesJson(article: ArticleRead, body: string) {
  const mined = cveIdsFromText(article.title, article.description, body);
  return JSON.stringify([...new Set([...(article.cveIds ?? []), ...mined])].slice(0, 16));
}

export function saveExtract(itemId: number, article: ArticleRead) {
  const db = getDb();
  const item = db
    .prepare("SELECT id, title, summary, topics, locations, url FROM items WHERE id = ?")
    .get(itemId) as
    | { id: number; title: string; summary: string | null; topics: string; locations: string; url: string }
    | undefined;
  if (!item) return;
  const body = (article.paragraphs ?? []).join("\n\n").trim();
  if (!body) return;
  const now = Date.now();
  db.prepare(
    `INSERT INTO extracts (item_id, url, title, description, body, quotes, language, cves, extracted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET
       url = excluded.url,
       title = excluded.title,
       description = excluded.description,
       body = excluded.body,
       quotes = excluded.quotes,
       language = excluded.language,
       cves = excluded.cves,
       extracted_at = excluded.extracted_at`,
  ).run(
    itemId,
    article.url || item.url,
    article.title,
    article.description,
    body,
    quotesJson(article),
    article.language,
    cvesJson(article, body),
    now,
  );
  upsertItemFts(itemId, item.title, item.summary, body);
  const classified = classify(`${item.title}\n${item.summary ?? ""}\n${body}`);
  const topics = [...new Set([...parseJsonList(item.topics), ...classified.topics])].slice(0, 8);
  const locations = [...new Set([...parseJsonList(item.locations), ...classified.locations])].slice(0, 8);
  db.prepare("UPDATE items SET topics = ?, locations = ? WHERE id = ?").run(
    JSON.stringify(topics),
    JSON.stringify(locations),
    itemId,
  );
  const pageDate = normalizePublishMs(article.publishedAt);
  if (pageDate) {
    db.prepare(
      `UPDATE items SET published_at = ?
       WHERE id = ? AND (published_at IS NULL OR published_at > ?)`,
    ).run(pageDate, itemId, pageDate);
  }
  indexItemEntities(itemId, `${item.title}\n${item.summary ?? ""}\n${body}`, {
    title: item.title,
    summary: item.summary,
    author: null,
  });
}

export function saveExtractForUrl(url: string, article: ArticleRead) {
  const ids = findItemIdsByUrl(url);
  for (const id of ids) saveExtract(id, article);
  return ids;
}

export function extractSnippet(body: string | null | undefined) {
  if (!body) return null;
  const text = body.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > EXTRACT_SNIPPET_MAX ? `${text.slice(0, EXTRACT_SNIPPET_MAX)}…` : text;
}

function parseJsonList(raw: string | undefined) {
  if (!raw) return [] as string[];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}
