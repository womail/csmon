import { parseFacetToken, KIND_PREFIX, type FacetKind } from "./facets";
import { orgAttribution } from "./gazetteer/orgs";
import { mineItem, matchVendorName } from "./mine";
import { bylinePeople, itemOrgs, newsPeopleInText } from "./people";
import { resolvePlace } from "./places";
import { SOURCE_TYPE_LABEL, isSourceType, sourceCategory } from "./source-types";
import { familiesForItem, topicFamily } from "./topic-families";
import type { Item, Source } from "./types";

export type IndexKind = Extract<
  FacetKind,
  "topic" | "family" | "tag" | "place" | "person" | "org" | "vendor" | "cve" | "source" | "category" | "stype"
>;

export type IndexEntry = {
  kind: IndexKind;
  value: string;
  label: string;
  count: number;
  /** Role, attribution, or type, shown after the label. */
  hint?: string;
};

const KINDS: IndexKind[] = ["topic", "family", "tag", "place", "person", "org", "vendor", "cve", "source", "category", "stype"];

/** Every facet value on the given items with its item count. Pure; runs on the board's items only. */
export function buildFacetIndex(items: Item[], sources: Map<number, Source>): IndexEntry[] {
  const rows = new Map<string, IndexEntry>();
  function bump(kind: IndexKind, value: string, label = value, hint?: string) {
    if (!value) return;
    const key = `${kind}:${value.toLowerCase()}`;
    const row = rows.get(key);
    if (row) row.count += 1;
    else rows.set(key, { kind, value, label, count: 1, hint });
  }
  for (const item of items) {
    const source = sources.get(item.sourceId);
    const seen = new Set<string>();
    const once = (kind: IndexKind, value: string, label?: string, hint?: string) => {
      const key = `${kind}:${value.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      bump(kind, value, label, hint);
    };
    for (const topic of item.topics) once("topic", topic);
    for (const family of familiesForItem(item)) once("family", family, topicFamily(family).label);
    for (const tag of item.tags) if (!item.topics.includes(tag)) once("tag", tag);
    for (const place of item.locations) once("place", resolvePlace(place));
    const text = `${item.title} ${item.summary ?? ""}`;
    for (const name of bylinePeople(item, source)) once("person", name, name, "byline");
    for (const row of newsPeopleInText(text)) once("person", row.name, row.name, row.role ?? undefined);
    for (const org of itemOrgs(item)) once("org", org.name, org.name, orgAttribution(org) ?? undefined);
    const mined = mineItem(item);
    for (const vendor of mined.vendors) once("vendor", matchVendorName(vendor) ?? vendor);
    for (const cve of mined.cves) once("cve", cve.toUpperCase());
    if (source) {
      once("source", String(source.id), source.name);
      once("category", sourceCategory(source));
      if (isSourceType(source.sourceType)) once("stype", source.sourceType, SOURCE_TYPE_LABEL[source.sourceType]);
    }
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function topEntries(index: IndexEntry[], kind: IndexKind, limit = 12) {
  return index.filter((row) => row.kind === kind).slice(0, limit);
}

/** `place:ire` → kind place, needle "ire". Unknown prefixes stay as plain text. */
export function splitPrefix(query: string): { kind: IndexKind | null; needle: string } {
  const text = query.trim();
  const colon = text.indexOf(":");
  if (colon > 0) {
    const parsed = parseFacetToken(`${text}${text.endsWith(":") ? "x" : ""}`);
    if (parsed && (KINDS as string[]).includes(parsed.kind)) {
      return { kind: parsed.kind as IndexKind, needle: text.endsWith(":") ? "" : parsed.value.toLowerCase() };
    }
  }
  return { kind: null, needle: text.toLowerCase() };
}

function matchRank(label: string, needle: string): number {
  if (!needle) return 1;
  const lower = label.toLowerCase();
  if (lower.startsWith(needle)) return 3;
  if (lower.split(/[\s\-·/]+/).some((word) => word.startsWith(needle))) return 2;
  if (lower.includes(needle)) return 1;
  return 0;
}

export const PALETTE_RECENT_KEY = "csmon.palette-recent";

export function entryKey(entry: Pick<IndexEntry, "kind" | "value">) {
  return `${entry.kind}:${entry.value.toLowerCase()}`;
}

/** Exact prefix > word start > substring; ties by count, then by recent use. */
export function rankEntries(
  index: IndexEntry[],
  query: string,
  opts: { recent?: string[]; limit?: number } = {},
): IndexEntry[] {
  const { kind, needle } = splitPrefix(query);
  const recent = opts.recent ?? [];
  const scored: { entry: IndexEntry; rank: number; recency: number }[] = [];
  for (const entry of index) {
    if (kind && entry.kind !== kind) continue;
    const rank = Math.max(matchRank(entry.label, needle), entry.value !== entry.label ? matchRank(entry.value, needle) : 0);
    if (!rank) continue;
    const at = recent.indexOf(entryKey(entry));
    scored.push({ entry, rank, recency: at === -1 ? Infinity : at });
  }
  scored.sort(
    (a, b) => b.rank - a.rank || b.entry.count - a.entry.count || a.recency - b.recency || a.entry.label.localeCompare(b.entry.label),
  );
  return scored.slice(0, opts.limit ?? 40).map((row) => row.entry);
}

export function loadPaletteRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PALETTE_RECENT_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.map(String).slice(0, 20) : [];
  } catch {
    return [];
  }
}

export function rememberPalettePick(entry: Pick<IndexEntry, "kind" | "value">) {
  if (typeof window === "undefined") return;
  const key = entryKey(entry);
  const next = [key, ...loadPaletteRecent().filter((row) => row !== key)].slice(0, 20);
  window.localStorage.setItem(PALETTE_RECENT_KEY, JSON.stringify(next));
}

export function entryToken(entry: Pick<IndexEntry, "kind" | "value">) {
  const prefix = KIND_PREFIX[entry.kind];
  const value = /[\s,"]/.test(entry.value) ? `"${entry.value}"` : entry.value;
  return `${prefix}:${value}`;
}
