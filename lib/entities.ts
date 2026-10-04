import "server-only";

import { classify } from "./classify";
import { getDb } from "./db";
import { mineThreatIocs } from "./ioc";
import { mineText } from "./mine";
import { figuresInText, personName } from "./people";
import { resolvePlace } from "./places";
import type { EntityKind, Item, ItemEntity, Source } from "./types";

const ORGS: { label: string; re: RegExp }[] = [
  { label: "CISA", re: /\bcisa\b/i },
  { label: "NCSC", re: /\bncsc\b/i },
  { label: "CERT-EU", re: /\bcert-eu\b/i },
  { label: "NSA", re: /\bnsa\b/i },
  { label: "FBI", re: /\bfbi\b/i },
  { label: "Europol", re: /\beuropol\b/i },
  { label: "NATO", re: /\bnato\b/i },
  { label: "LockBit", re: /\blockbit\b/i },
  { label: "CL0P", re: /\bcl0p\b|\bclop\b/i },
  { label: "Akira", re: /\bakira ransomware\b|\bransomware.{0,12}akira\b/i },
  { label: "Black Basta", re: /\bblack basta\b/i },
  { label: "APT28", re: /\bapt28\b|\bfancy bear\b/i },
  { label: "APT29", re: /\bapt29\b|\bcozy bear\b/i },
  { label: "Lazarus", re: /\blazarus (group|apt)\b/i },
  { label: "Volt Typhoon", re: /\bvolt typhoon\b/i },
  { label: "Wagner", re: /\bwagner (group|pmc)\b/i },
  { label: "Hamas", re: /\bhamas\b/i },
  { label: "Hezbollah", re: /\bhezbollah\b/i },
  { label: "Houthis", re: /\bhouthis?\b/i },
];

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
  function push(kind: EntityKind, label: string, key = normKey(label)) {
    if (!key || key.length < 2) return;
    const id = `${kind}:${key}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ kind, key, label });
  }

  const mined = mineText(hay);
  for (const cve of mined.cves) push("cve", cve, cve.toLowerCase());
  for (const vendor of mined.vendors) push("vendor", vendor);
  for (const place of classify(hay).locations) push("place", resolvePlace(place));
  for (const org of ORGS) {
    if (org.re.test(hay)) push("org", org.label);
  }
  if (item) {
    const author = personName(
      { ...item, id: 0, sourceId: 0, externalId: "", url: "", publishedAt: null, tags: [], topics: [], locations: [], fetchedAt: 0 },
      source,
    );
    if (author) push("person", author);
  }
  for (const figure of figuresInText(hay)) push("person", figure);
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
     VALUES (?, ?, ?, NULL, ?, ?)
     ON CONFLICT(kind, key) DO UPDATE SET
       label = excluded.label,
       last_seen = excluded.last_seen
     RETURNING id`,
  );
  const link = db.prepare(
    `INSERT OR IGNORE INTO item_entities (item_id, entity_id) VALUES (?, ?)`,
  );
  for (const seed of seeds) {
    const row = upsert.get(seed.kind, seed.key, seed.label, now, now) as { id: number } | undefined;
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
      .all(limit) as ItemEntity[]
  );
}
