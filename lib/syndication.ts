import type { Item } from "./types";

/**
 * Syndication detection: decide which of a story's sources are independent origins and which
 * re-publish the same copy (wire stories, aggregator relays of one URL, near-identical text).
 */

export type SyndicationReason = "same-url" | "wire" | "same-text";

export type StoryOrigin = {
  sourceIds: number[];
  /** Why sources beyond the first were folded into this origin; empty when it stands alone. */
  reasons: SyndicationReason[];
  wire: string | null;
};

const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|mc_|ocid$|cmpid$|ref$|ref_src$|smid$|taid$|at_)/i;

/** URL identity across feeds: drop scheme, www., hash, tracking params, AMP and trailing slash. */
export function canonicalUrl(url: string) {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAM.test(key)) parsed.searchParams.delete(key);
    }
    parsed.searchParams.sort();
    const host = parsed.hostname.replace(/^(www\.|amp\.|m\.)/, "");
    const path = parsed.pathname.replace(/\/amp\/?$/, "").replace(/\.amp$/, "").replace(/\/+$/, "");
    const search = parsed.searchParams.toString();
    return `${host}${path}${search ? `?${search}` : ""}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

const WIRES: [string, RegExp][] = [
  ["Reuters", /\(reuters\)|\breuters\s*[-—–]|^reuters\b|—\s*reuters$/i],
  ["AP", /\((?:ap|associated press)\)|\bassociated press\b/i],
  ["AFP", /\(afp\)|\bagence france-presse\b|\bafp\s*[-—–]/i],
  ["PA", /\(pa\)|\bpa media\b/i],
  ["Bloomberg", /\(bloomberg\)/i],
  ["dpa", /\(dpa\)/i],
  ["ANSA", /\(ansa\)/i],
  ["EFE", /\(efe\)/i],
];

export function wireAttribution(item: Pick<Item, "title" | "summary" | "author">) {
  const lead = `${item.author ?? ""} ${item.title} ${(item.summary ?? "").slice(0, 240)}`;
  for (const [name, pattern] of WIRES) if (pattern.test(lead)) return name;
  return null;
}

function words(text: string) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** 5-word shingles of the title + summary, empty when there is too little text to judge. */
export function textShingles(item: Pick<Item, "title" | "summary">) {
  const tokens = words(`${item.title} ${item.summary ?? ""}`);
  const out = new Set<string>();
  if (tokens.length < 20) return out;
  for (let i = 0; i + 5 <= tokens.length && out.size < 400; i += 1) {
    out.add(tokens.slice(i, i + 5).join(" "));
  }
  return out;
}

export const SAME_TEXT_THRESHOLD = 0.5;

export function shingleSimilarity(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const shingle of small) if (large.has(shingle)) shared += 1;
  return shared / small.size;
}

const cache = new WeakMap<Item[], StoryOrigin[]>();

/** Group a story's items into independent origins. Cached per items array. */
export function storyOrigins(items: Item[]): StoryOrigin[] {
  const hit = cache.get(items);
  if (hit) return hit;
  const sample = items.slice(0, 60);
  const sourceIds = [...new Set(sample.map((item) => item.sourceId))];
  const parent = new Map(sourceIds.map((id) => [id, id]));
  const reasons = new Map<number, Set<SyndicationReason>>();
  const wireOf = new Map<number, string>();
  const find = (id: number): number => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  const join = (a: number, b: number, reason: SyndicationReason) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    parent.set(rb, ra);
    const set = reasons.get(ra) ?? new Set();
    set.add(reason);
    for (const prior of reasons.get(rb) ?? []) set.add(prior);
    reasons.set(ra, set);
  };

  if (sourceIds.length > 1) {
    const byUrl = new Map<string, number>();
    const byWire = new Map<string, number>();
    const shingles = sample.map((item) => textShingles(item));
    sample.forEach((item, index) => {
      const url = canonicalUrl(item.url);
      const urlOwner = byUrl.get(url);
      if (urlOwner === undefined) byUrl.set(url, item.sourceId);
      else if (urlOwner !== item.sourceId) join(urlOwner, item.sourceId, "same-url");

      const wire = wireAttribution(item);
      if (wire) {
        wireOf.set(item.sourceId, wire);
        const wireOwner = byWire.get(wire);
        if (wireOwner === undefined) byWire.set(wire, item.sourceId);
        else if (wireOwner !== item.sourceId) join(wireOwner, item.sourceId, "wire");
      }

      for (let other = 0; other < index; other += 1) {
        if (sample[other].sourceId === item.sourceId) continue;
        if (shingleSimilarity(shingles[index], shingles[other]) >= SAME_TEXT_THRESHOLD) {
          join(sample[other].sourceId, item.sourceId, "same-text");
        }
      }
    });
  }

  const groups = new Map<number, number[]>();
  for (const id of sourceIds) {
    const root = find(id);
    groups.set(root, [...(groups.get(root) ?? []), id]);
  }
  const origins = [...groups.entries()].map(([root, ids]) => ({
    sourceIds: ids,
    reasons: ids.length > 1 ? [...(reasons.get(root) ?? [])] : [],
    wire: ids.map((id) => wireOf.get(id)).find(Boolean) ?? null,
  }));
  cache.set(items, origins);
  return origins;
}

/** Number of independent origins behind a story (at least 1 when it has items). */
export function independentSourceCount(items: Item[]) {
  return storyOrigins(items).length;
}
