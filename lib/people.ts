import type { Item, Source } from "./types";

export type PersonRow = {
  name: string;
  count: number;
  sample: string;
  sourceIds: number[];
  topics: string[];
};

const SKIP = new Set(["unknown", "admin", "editor", "staff", "reuters", "ap", "afp"]);

export function personName(item: Item, source?: Source | null) {
  const raw = (item.author ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return null;
  if (source?.name && raw.toLowerCase() === source.name.toLowerCase()) return null;
  if (SKIP.has(raw.toLowerCase())) return null;
  if (raw.length < 3 || raw.length > 64) return null;
  return raw;
}

export function itemHasPerson(item: Item, person: string | null, source?: Source | null) {
  if (!person) return true;
  const name = personName(item, source);
  if (name && name.toLowerCase() === person.toLowerCase()) return true;
  return `${item.title} ${item.summary ?? ""}`.toLowerCase().includes(person.toLowerCase());
}

export function peopleFromItems(items: Item[], sources: Map<number, Source>): PersonRow[] {
  const rows = new Map<string, PersonRow>();
  for (const item of items) {
    const name = personName(item, sources.get(item.sourceId));
    if (!name) continue;
    const key = name.toLowerCase();
    const current = rows.get(key);
    if (!current) {
      rows.set(key, {
        name,
        count: 1,
        sample: item.title,
        sourceIds: [item.sourceId],
        topics: item.topics.slice(0, 3),
      });
      continue;
    }
    current.count += 1;
    if (!current.sourceIds.includes(item.sourceId)) current.sourceIds.push(item.sourceId);
    for (const topic of item.topics) {
      if (!current.topics.includes(topic) && current.topics.length < 4) current.topics.push(topic);
    }
  }
  return [...rows.values()].sort((a, b) => b.count - a.count);
}
