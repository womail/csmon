import { fail, gate, jsonOk, readJson } from "@/lib/guard";
import { getDb } from "@/lib/db";
import { listClassifyTopics } from "@/lib/classify";
import { monitorStateFromRequest } from "@/lib/monitor-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(listClassifyTopics());

export async function POST(request: Request) {
  const blocked = gate(request, "items", 30);
  if (blocked) return blocked;
  try {
    const body = await readJson<{ itemId?: unknown; topics?: unknown }>(request);
    const itemId = Math.round(Number(body.itemId));
    if (!Number.isFinite(itemId) || itemId < 1) return jsonOk({ error: "Invalid item id." }, 400);
    if (!Array.isArray(body.topics)) return jsonOk({ error: "Send a topics array." }, 400);
    const topics = body.topics
      .map((value) => String(value).trim().toLowerCase())
      .filter((topic) => topic && ALLOWED.has(topic))
      .slice(0, 8);
    if (!topics.length) return jsonOk({ error: "Pick at least one known topic." }, 400);

    const db = getDb();
    const row = db
      .prepare("SELECT id, title, summary, tags FROM items WHERE id = ?")
      .get(itemId) as { id: number; title: string; summary: string | null; tags: string } | undefined;
    if (!row) return jsonOk({ error: "Item not found." }, 404);

    let priorTags: string[] = [];
    try {
      priorTags = JSON.parse(row.tags) as string[];
      if (!Array.isArray(priorTags)) priorTags = [];
    } catch {
      priorTags = [];
    }
    const topicSet = new Set(topics);
    const tags = [
      ...new Set([
        ...topics,
        ...priorTags.filter((tag) => !ALLOWED.has(tag) || topicSet.has(tag)),
      ]),
    ].slice(0, 8);

    db.prepare("UPDATE items SET topics = ?, tags = ? WHERE id = ?").run(
      JSON.stringify(topics),
      JSON.stringify(tags),
      itemId,
    );
    try {
      const extract = db.prepare("SELECT body FROM extracts WHERE item_id = ?").get(itemId) as
        | { body: string }
        | undefined;
      db.prepare("DELETE FROM items_fts WHERE rowid = ?").run(itemId);
      db.prepare(
        `INSERT INTO items_fts(rowid, title, summary, body) VALUES (?, ?, ?, ?)`,
      ).run(itemId, row.title, row.summary ?? "", extract?.body ?? "");
    } catch {
      /* FTS optional */
    }

    return jsonOk(monitorStateFromRequest(request));
  } catch (error) {
    return fail(error, "Reclassify failed");
  }
}
