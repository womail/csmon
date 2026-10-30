import { fail, gate, jsonOk, readJson } from "@/lib/guard";
import { getDb, withTransaction } from "@/lib/db";
import { listClassifyTopics } from "@/lib/classify";
import { monitorStateFromRequest } from "@/lib/monitor-state";
import { resetItemTopics } from "@/lib/reclassify-backfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(listClassifyTopics());
const MAX_BATCH = 500;

function cleanTopics(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw.map((value) => String(value).trim().toLowerCase()).filter((topic) => topic && ALLOWED.has(topic)),
    ),
  ].slice(0, 8);
}

function parseList(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

/** Write the user's topics and lock them against the classifier. Returns false when the item is gone. */
function lockTopics(itemId: number, topics: string[]) {
  const db = getDb();
  const row = db
    .prepare("SELECT id, title, summary, tags FROM items WHERE id = ?")
    .get(itemId) as { id: number; title: string; summary: string | null; tags: string } | undefined;
  if (!row) return false;
  const topicSet = new Set(topics);
  const tags = [
    ...new Set([...topics, ...parseList(row.tags).filter((tag) => !ALLOWED.has(tag) || topicSet.has(tag))]),
  ].slice(0, 8);
  db.prepare("UPDATE items SET topics = ?, tags = ?, topics_locked = 1 WHERE id = ?").run(
    JSON.stringify(topics),
    JSON.stringify(tags),
    itemId,
  );
  try {
    const extract = db.prepare("SELECT body FROM extracts WHERE item_id = ?").get(itemId) as
      | { body: string }
      | undefined;
    db.prepare("DELETE FROM items_fts WHERE rowid = ?").run(itemId);
    db.prepare(`INSERT INTO items_fts(rowid, title, summary, body) VALUES (?, ?, ?, ?)`).run(
      itemId,
      row.title,
      row.summary ?? "",
      extract?.body ?? "",
    );
  } catch {
    /* FTS optional */
  }
  return true;
}

/**
 * `{ itemId, topics }` locks one item; `{ items: [{ itemId, topics }] }` locks up to 500 (browser override sync);
 * `{ itemId, reset: true }` clears the lock and re-scores.
 */
export async function POST(request: Request) {
  const blocked = gate(request, "items", 30);
  if (blocked) return blocked;
  try {
    const body = await readJson<{ itemId?: unknown; topics?: unknown; reset?: unknown; items?: unknown }>(
      request,
      256_000,
    );

    if (Array.isArray(body.items)) {
      let locked = 0;
      withTransaction(() => {
        for (const entry of body.items as { itemId?: unknown; topics?: unknown }[]) {
          if (locked >= MAX_BATCH) break;
          const itemId = Math.round(Number(entry?.itemId));
          const topics = cleanTopics(entry?.topics);
          if (!Number.isFinite(itemId) || itemId < 1 || !topics.length) continue;
          if (lockTopics(itemId, topics)) locked += 1;
        }
      });
      return jsonOk({ locked });
    }

    const itemId = Math.round(Number(body.itemId));
    if (!Number.isFinite(itemId) || itemId < 1) return jsonOk({ error: "Invalid item id." }, 400);

    if (body.reset === true) {
      if (!resetItemTopics(itemId)) return jsonOk({ error: "Item not found." }, 404);
      return jsonOk(monitorStateFromRequest(request));
    }

    if (!Array.isArray(body.topics)) return jsonOk({ error: "Send a topics array." }, 400);
    const topics = cleanTopics(body.topics);
    if (!topics.length) return jsonOk({ error: "Pick at least one known topic." }, 400);
    if (!lockTopics(itemId, topics)) return jsonOk({ error: "Item not found." }, 404);
    return jsonOk(monitorStateFromRequest(request));
  } catch (error) {
    return fail(error, "Reclassify failed");
  }
}
