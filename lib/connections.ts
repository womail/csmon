import type { Story } from "./cluster";
import { mineItem, mineText, matchVendorName } from "./mine";
import { orgsInText } from "./gazetteer/orgs";
import { bylinePeople, itemOrgs, newsPeopleInText } from "./people";
import { resolvePlace } from "./places";
import { isSourceType, sourceCategory } from "./source-types";
import type { Item, Source } from "./types";

export type RefKind = "topic" | "place" | "person" | "org" | "vendor" | "cve" | "category" | "stype";

export type EntityRef = { kind: RefKind; value: string };

export type Connection = EntityRef & {
  /** Stories in the focus set that carry this ref. */
  together: number;
  /** Stories in the focus set. */
  focus: number;
  /** Stories in the whole range that carry this ref. */
  base: number;
  total: number;
  /** (together / focus) / (base / total). */
  lift: number;
  score: number;
};

export function refKey(ref: EntityRef) {
  return `${ref.kind}:${ref.value.toLowerCase()}`;
}

const itemCache = new WeakMap<Item, { source: Source | undefined; refs: EntityRef[] }>();

/** All entity refs for one item; memoised per item object. */
export function itemRefs(item: Item, source: Source | undefined): EntityRef[] {
  const hit = itemCache.get(item);
  if (hit && hit.source === source) return hit.refs;
  const refs = new Map<string, EntityRef>();
  const add = (kind: RefKind, value: string) => {
    if (!value) return;
    const ref = { kind, value };
    refs.set(refKey(ref), ref);
  };
  for (const topic of item.topics) add("topic", topic);
  for (const place of item.locations) add("place", resolvePlace(place));
  for (const name of bylinePeople(item, source)) add("person", name);
  for (const row of newsPeopleInText(`${item.title} ${item.summary ?? ""}`)) add("person", row.name);
  for (const org of itemOrgs(item)) add("org", org.name);
  const mined = mineItem(item);
  for (const vendor of mined.vendors) add("vendor", matchVendorName(vendor) ?? vendor);
  for (const cve of mined.cves) add("cve", cve.toUpperCase());
  if (source) {
    add("category", sourceCategory(source));
    if (isSourceType(source.sourceType)) add("stype", source.sourceType);
  }
  const list = [...refs.values()];
  itemCache.set(item, { source, refs: list });
  return list;
}

const storyCache = new WeakMap<Story, Map<string, EntityRef>>();

/** Union of the story's item refs, so ten syndicated copies count once. */
export function storyRefs(story: Story, sources: Map<number, Source>): Map<string, EntityRef> {
  const hit = storyCache.get(story);
  if (hit) return hit;
  const refs = new Map<string, EntityRef>();
  for (const item of story.items) {
    for (const ref of itemRefs(item, sources.get(item.sourceId))) refs.set(refKey(ref), ref);
  }
  storyCache.set(story, refs);
  return refs;
}

export type ConnectionOpts = {
  minTogether?: number;
  minLift?: number;
  perKind?: number;
  limit?: number;
  exclude?: EntityRef[];
  kinds?: RefKind[];
};

/** What co-occurs with the focus set more than usual across the range. */
export function connectionsFor(
  focusStories: Story[],
  allStories: Story[],
  sources: Map<number, Source>,
  opts: ConnectionOpts = {},
): Connection[] {
  const minTogether = opts.minTogether ?? 2;
  const minLift = opts.minLift ?? 1.3;
  const perKind = opts.perKind ?? 3;
  const excluded = new Set((opts.exclude ?? []).map(refKey));
  const kinds = opts.kinds ? new Set(opts.kinds) : null;
  const focus = focusStories.length;
  const total = allStories.length;
  if (!focus || !total) return [];

  const base = new Map<string, number>();
  for (const story of allStories) {
    for (const key of storyRefs(story, sources).keys()) base.set(key, (base.get(key) ?? 0) + 1);
  }
  const together = new Map<string, { ref: EntityRef; n: number }>();
  for (const story of focusStories) {
    for (const [key, ref] of storyRefs(story, sources)) {
      const row = together.get(key);
      if (row) row.n += 1;
      else together.set(key, { ref, n: 1 });
    }
  }

  const rows: Connection[] = [];
  for (const [key, { ref, n }] of together) {
    if (excluded.has(key) || (kinds && !kinds.has(ref.kind))) continue;
    if (n < minTogether) continue;
    const baseCount = Math.max(base.get(key) ?? n, n);
    const lift = n / focus / (baseCount / total);
    if (lift < minLift) continue;
    rows.push({ ...ref, together: n, focus, base: baseCount, total, lift, score: n * Math.log2(1 + lift) });
  }
  rows.sort((a, b) => b.score - a.score || b.together - a.together || refKey(a).localeCompare(refKey(b)));

  const perKindCount = new Map<RefKind, number>();
  const out: Connection[] = [];
  for (const row of rows) {
    const used = perKindCount.get(row.kind) ?? 0;
    if (used >= perKind) continue;
    perKindCount.set(row.kind, used + 1);
    out.push(row);
    if (opts.limit && out.length >= opts.limit) break;
  }
  return out;
}

/** Stories other than `story` that carry the ref, newest first. */
export function storiesWithRef(ref: EntityRef, stories: Story[], sources: Map<number, Source>, except?: Story) {
  const key = refKey(ref);
  return stories
    .filter((story) => story !== except && storyRefs(story, sources).has(key))
    .sort((a, b) => b.latestAt - a.latestAt);
}

export function itemMatchesRef(item: Item, ref: EntityRef, source: Source | undefined) {
  const key = refKey(ref);
  return itemRefs(item, source).some((row) => refKey(row) === key);
}

/** `org:APT28` → ref; null for kinds the dossier does not cover. */
export function parseRefToken(token: string | null): EntityRef | null {
  if (!token) return null;
  const colon = token.indexOf(":");
  if (colon <= 0) return null;
  const kind = token.slice(0, colon) as RefKind | "source";
  const value = token.slice(colon + 1).replace(/^"|"$/g, "").trim();
  if (!value) return null;
  const kinds: string[] = ["topic", "place", "person", "org", "vendor", "cve", "category", "stype"];
  return kinds.includes(kind) ? { kind: kind as RefKind, value } : null;
}

/** Items per day, oldest first, ending today (UTC days). */
export function dailyCounts(items: Item[], days: number, now = Date.now()): number[] {
  const DAY = 24 * 60 * 60 * 1000;
  const end = Math.floor(now / DAY);
  const out = new Array<number>(days).fill(0);
  for (const item of items) {
    const day = Math.floor((item.publishedAt ?? item.fetchedAt) / DAY);
    const index = days - 1 - (end - day);
    if (index >= 0 && index < days) out[index] += 1;
  }
  return out;
}

/** "2 CERTs · 1 vendor · 6 outlets" grouping of the sources behind the items. */
export function coverageByType(items: Item[], sources: Map<number, Source>) {
  const byType = new Map<string, Set<number>>();
  for (const item of items) {
    const type = sources.get(item.sourceId)?.sourceType ?? "outlet";
    const set = byType.get(type) ?? new Set<number>();
    set.add(item.sourceId);
    byType.set(type, set);
  }
  return [...byType.entries()]
    .map(([type, ids]) => ({ type, sourceIds: [...ids] }))
    .sort((a, b) => b.sourceIds.length - a.sourceIds.length);
}

/** Options → stack is a comma or space list of product words. */
export function vendorInStack(vendor: string, stack: string) {
  const words = stack
    .toLowerCase()
    .split(/[,\s]+/)
    .filter((word) => word.length > 2);
  const name = vendor.toLowerCase();
  return words.some((word) => name.includes(word) || word.includes(name));
}

const LINK_KINDS = new Set<RefKind>(["org", "cve", "vendor"]);

/** Org, CVE, and vendor refs named in report stories (title, summary, CVE list). */
export function reportRefs(stories: { title: string; summary: string | null; cves?: string[] }[]): Map<string, EntityRef> {
  const out = new Map<string, EntityRef>();
  const add = (ref: EntityRef) => out.set(refKey(ref), ref);
  for (const story of stories) {
    const text = `${story.title} ${story.summary ?? ""}`;
    for (const org of orgsInText(text)) add({ kind: "org", value: org.name });
    const mined = mineText(text);
    for (const vendor of mined.vendors) add({ kind: "vendor", value: matchVendorName(vendor) ?? vendor });
    for (const cve of [...mined.cves, ...(story.cves ?? [])]) add({ kind: "cve", value: cve.toUpperCase() });
  }
  return out;
}

/** First org, CVE, or vendor the story shares with the report; orgs win over CVEs over vendors. */
export function sharedReportRef(story: Story, report: Map<string, EntityRef>, sources: Map<number, Source>): EntityRef | null {
  if (!report.size) return null;
  let best: EntityRef | null = null;
  const rank = (ref: EntityRef) => ["org", "cve", "vendor"].indexOf(ref.kind);
  for (const [key, ref] of storyRefs(story, sources)) {
    if (!LINK_KINDS.has(ref.kind) || !report.has(key)) continue;
    if (!best || rank(ref) < rank(best)) best = ref;
  }
  return best;
}

export function connectionTip(row: Connection, label: string) {
  return `${row.together} of ${row.focus} stories in this view also mention ${label} — ${row.lift.toFixed(1)}× more often than across all stories in the range.`;
}
