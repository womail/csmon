import "server-only";

import { classifyItem, withoutWeatherCyberTags } from "./classify";
import { getDb, withTransaction } from "./db";
import { indexItemEntities } from "./entities";
import { personName } from "./people";
import { listSources } from "./queries";
import { topicHintForSource } from "./source-types";
import { CLASSIFIER_VERSION } from "./topic-rules";
import type { Source } from "./types";

type Row = {
  id: number;
  source_id: number;
  title: string;
  summary: string | null;
  url: string;
  author: string | null;
  topics: string;
};

export function pendingReclassifyCount(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM items WHERE classifier_version < ? AND topics_locked = 0")
    .get(CLASSIFIER_VERSION) as { n: number };
  return Number(row.n);
}

function sameSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((value) => set.has(value));
}

function parseList(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

function rescoreRows(rows: Row[], sources: Map<number, Source>) {
  const db = getDb();
  const update = db.prepare(
    "UPDATE items SET topics = ?, tags = ?, locations = ?, author = ?, classifier_version = ? WHERE id = ?",
  );
  const unlink = db.prepare("DELETE FROM item_entities WHERE item_id = ?");
  let changed = 0;
  withTransaction(() => {
    for (const row of rows) {
      const source = sources.get(row.source_id) ?? null;
      const classified = classifyItem(row.title, row.summary, topicHintForSource(source));
      const cleaned = withoutWeatherCyberTags(
        classified.topics,
        classified.tags,
        `${row.title} ${row.summary ?? ""} ${row.url}`,
      );
      const author = personName({ author: row.author }, source);
      update.run(
        JSON.stringify(cleaned.topics),
        JSON.stringify(cleaned.tags),
        JSON.stringify(classified.locations),
        author,
        CLASSIFIER_VERSION,
        row.id,
      );
      if (!sameSet(parseList(row.topics), cleaned.topics)) changed += 1;
      unlink.run(row.id);
      indexItemEntities(
        row.id,
        `${row.title}\n${row.summary ?? ""}`,
        { title: row.title, summary: row.summary, author },
        source,
      );
    }
  });
  return changed;
}

function sourceMap() {
  return new Map(listSources().map((source) => [source.id, source]));
}

/** Re-score up to `limit` rows whose classifier_version < CLASSIFIER_VERSION and topics_locked = 0. Newest first. */
export function reclassifyBatch(limit = 1000): { updated: number; changed: number; remaining: number } {
  const rows = getDb()
    .prepare(
      `SELECT id, source_id, title, summary, url, author, topics FROM items
       WHERE classifier_version < ? AND topics_locked = 0
       ORDER BY id DESC LIMIT ?`,
    )
    .all(CLASSIFIER_VERSION, limit) as Row[];
  if (!rows.length) return { updated: 0, changed: 0, remaining: 0 };
  const changed = rescoreRows(rows, sourceMap());
  return { updated: rows.length, changed, remaining: pendingReclassifyCount() };
}

/** Clear the user's lock on one item and score it again. */
export function resetItemTopics(itemId: number): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT id, source_id, title, summary, url, author, topics FROM items WHERE id = ?")
    .get(itemId) as Row | undefined;
  if (!row) return false;
  db.prepare("UPDATE items SET topics_locked = 0 WHERE id = ?").run(itemId);
  rescoreRows([row], sourceMap());
  return true;
}
