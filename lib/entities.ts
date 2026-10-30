import "server-only";

import { classify } from "./classify";
import { getDb } from "./db";
import { mineThreatIocs } from "./ioc";
import { mineText } from "./mine";
import { orgsInText } from "./gazetteer/orgs";
import { bylinePeople, newsPeopleInText } from "./people";
import { resolvePlace } from "./places";
import type { EntityKind, Item, ItemEntity, Source } from "./types";

function normKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function collectEntitySeeds(
  text: string,
  item?: Pick<Item, "title" | "summary" | "author">,
  source?: Source | null,
): ItemEntity[] {
  const hay = text.trim();
  if (!hay) return [];
  const out: ItemEntity[] = [];
  const seen = new Set<string>();
  function push(kind: EntityKind, label: string, key = normKey(label), extra?: Record<string, string>) {
    if (!key || key.length < 2) return;
    const id = `${kind}:${key}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push(extra ? { kind, key, label, extra } : { kind, key, label });
  }

  const mined = mineText(hay);
  for (const cve of mined.cves) push("cve", cve, cve.toLowerCase());
  for (const vendor of mined.vendors) push("vendor", vendor);
  for (const place of classify(hay).locations) push("place", resolvePlace(place));
  for (const org of orgsInText(hay)) {
    push("org", org.name, undefined, { orgKind: org.kind, ...(org.country ? { country: org.country } : {}) });
  }
  if (item) {
    for (const name of bylinePeople(item, source)) push("person", name, undefined, { role: "byline" });
  }
  for (const row of newsPeopleInText(hay)) push("person", row.name, undefined, row.role ? { role: row.role } : undefined);
  for (const ioc of mineThreatIocs(hay, { limit: 12 })) {
    push("ioc", ioc.value, `${ioc.kind}:${ioc.value.toLowerCase()}`);
  }
  return out.slice(0, 24);
}

export function indexItemEntities(
  itemId: number,
  text: string,
  item?: Pick<Item, "title" | "summary" | "author">,
  source?: Source | null,
) {
  const seeds = collectEntitySeeds(text, item, source);
  if (!seeds.length) return seeds;
  const db = getDb();
  const now = Date.now();
  const upsert = db.prepare(
    `INSERT INTO entities (kind, key, label, extra, first_seen, last_seen)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(kind, key) DO UPDATE SET
       label = excluded.label,
       extra = COALESCE(excluded.extra, entities.extra),
       last_seen = excluded.last_seen
     RETURNING id`,
  );
  const link = db.prepare(
    `INSERT OR IGNORE INTO item_entities (item_id, entity_id) VALUES (?, ?)`,
  );
  for (const seed of seeds) {
    const extra = seed.extra ? JSON.stringify(seed.extra) : null;
    const row = upsert.get(seed.kind, seed.key, seed.label, extra, now, now) as { id: number } | undefined;
    if (row) link.run(itemId, row.id);
  }
  return seeds;
}

export function entitiesForItemIds(ids: number[]): Map<number, ItemEntity[]> {
  const map = new Map<number, ItemEntity[]>();
  if (!ids.length) return map;
  const placeholders = ids.map(() => "?").join(",");
  const rows = getDb()
    .prepare(
      `SELECT ie.item_id, e.kind, e.key, e.label
       FROM item_entities ie
       JOIN entities e ON e.id = ie.entity_id
       WHERE ie.item_id IN (${placeholders})`,
    )
    .all(...ids) as { item_id: number; kind: EntityKind; key: string; label: string }[];
  for (const row of rows) {
    const list = map.get(row.item_id) ?? [];
    list.push({ kind: row.kind, key: row.key, label: row.label });
    map.set(row.item_id, list);
  }
  return map;
}

export function listRecentEntities(limit = 40): ItemEntity[] {
  return (
    getDb()
      .prepare(
        `SELECT kind, key, label FROM entities ORDER BY last_seen DESC LIMIT ?`,
      )
      .all(limit) as unknown as ItemEntity[]
  );
}
