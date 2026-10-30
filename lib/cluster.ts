import { sortStoryTopics } from "./classify";
import { mineItem } from "./mine";
import { canonicalUrl, independentSourceCount } from "./syndication";
import type { Item, Source } from "./types";

const STOP = new Set([
  "the", "a", "an", "of", "in", "on", "to", "for", "and", "or", "with",
  "after", "before", "as", "at", "by", "from", "vs", "new", "says", "said",
  "over", "into", "about", "this", "that", "will", "been", "have", "has",
  "not", "but", "are", "was", "were", "its", "his", "her", "their",
]);

export type Story = {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  latestAt: number;
  topics: string[];
  locations: string[];
  tags: string[];
  items: Item[];
  sourceIds: number[];
};

export function clusterTokens(title: string) {
  return new Set(
    title
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w)),
  );
}

function overlapCount(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  const smaller = a.size <= b.size ? a : b;
  const larger = smaller === a ? b : a;
  let n = 0;
  for (const token of smaller) if (larger.has(token)) n += 1;
  return n;
}

function jaccard(a: Set<string>, b: Set<string>) {
  const inter = overlapCount(a, b);
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

function indexPush(index: Map<string, number[]>, key: string, group: number) {
  const list = index.get(key);
  if (list) list.push(group);
  else index.set(key, [group]);
}

function itemKey(item: Item) {
  return canonicalUrl(item.url);
}

export function itemAsStory(item: Item): Story {
  return {
    id: `item-${item.id}`,
    title: item.title,
    summary: item.summary,
    url: item.url,
    latestAt: item.publishedAt ?? 0,
    topics: item.topics,
    locations: item.locations,
    tags: item.tags,
    items: [item],
    sourceIds: [item.sourceId],
  };
}

export function clusterItems(items: Item[]): Story[] {
  const groups: {
    tokens: Set<string>;
    cves: Set<string>;
    urls: Set<string>;
    items: Item[];
  }[] = [];
  const tokenIndex = new Map<string, number[]>();
  const cveIndex = new Map<string, number[]>();
  const urlIndex = new Map<string, number>();

  for (const item of items) {
    const toks = clusterTokens(item.title);
    const cves = mineItem(item).cves;
    const url = itemKey(item);
    const candidates = new Set<number>();
    const urlHit = urlIndex.get(url);
    if (urlHit !== undefined) candidates.add(urlHit);
    for (const cve of cves) {
      const hits = cveIndex.get(cve);
      if (hits) for (const index of hits) candidates.add(index);
    }
    for (const token of toks) {
      const hits = tokenIndex.get(token);
      if (hits) for (const index of hits) candidates.add(index);
    }

    let placed = -1;
    for (const index of candidates) {
      const group = groups[index];
      if (!group) continue;
      if (group.urls.has(url)) {
        placed = index;
        break;
      }
      let sameCve = false;
      for (const cve of cves) {
        if (group.cves.has(cve)) {
          sameCve = true;
          break;
        }
      }
      if (sameCve) {
        placed = index;
        break;
      }
      const overlap = overlapCount(toks, group.tokens);
      if (overlap === 0) continue;
      const score = jaccard(toks, group.tokens);
      if (score >= 0.42 || (overlap >= 4 && score >= 0.28)) {
        placed = index;
        break;
      }
    }

    if (placed >= 0) {
      const group = groups[placed]!;
      group.items.push(item);
      group.urls.add(url);
      urlIndex.set(url, placed);
      for (const token of toks) {
        if (!group.tokens.has(token)) {
          group.tokens.add(token);
          indexPush(tokenIndex, token, placed);
        }
      }
      for (const cve of cves) {
        if (!group.cves.has(cve)) {
          group.cves.add(cve);
          indexPush(cveIndex, cve, placed);
        }
      }
    } else {
      const index = groups.length;
      groups.push({
        tokens: toks,
        cves: new Set(cves),
        urls: new Set([url]),
        items: [item],
      });
      urlIndex.set(url, index);
      for (const token of toks) indexPush(tokenIndex, token, index);
      for (const cve of cves) indexPush(cveIndex, cve, index);
    }
  }

  return groups
    .map((group) => {
      const sorted = [...group.items].sort(
        (a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0),
      );
      const head =
        sorted.find((item) => (item.summary ?? "").length > 80) ?? sorted[0];
      const topics = sortStoryTopics(sorted.flatMap((i) => i.topics));
      const locations = [...new Set(sorted.flatMap((i) => i.locations))];
      const summaries = [
        ...new Set(sorted.map((item) => item.summary).filter(Boolean) as string[]),
      ];
      return {
        id: `story-${sorted.map((item) => item.id).sort((a, b) => a - b).join("-")}`,
        title: head.title,
        summary: summaries[0] ?? head.summary,
        url: head.url,
        latestAt: sorted[0].publishedAt ?? 0,
        topics,
        locations,
        tags: [...new Set(sorted.flatMap((i) => i.tags))],
        items: sorted,
        sourceIds: [...new Set(sorted.map((i) => i.sourceId))],
      };
    })
    .sort((a, b) => {
      const sourceDelta = independentSourceCount(b.items) - independentSourceCount(a.items);
      if (sourceDelta) return sourceDelta;
      return b.latestAt - a.latestAt;
    });
}

export function storiesFromPool(pool: Story[], allowedIds: Set<number>, cross: boolean, hidden: string[]) {
  const out: Story[] = [];
  for (const story of pool) {
    let kept = story.items;
    let intact = true;
    for (const item of story.items) {
      if (!allowedIds.has(item.id)) {
        intact = false;
        break;
      }
    }
    if (!intact) {
      kept = story.items.filter((item) => allowedIds.has(item.id));
      if (!kept.length) continue;
    }
    const next = intact
      ? story
      : {
          ...story,
          items: kept,
          sourceIds: [...new Set(kept.map((item) => item.sourceId))],
          topics: sortStoryTopics(kept.flatMap((item) => item.topics)),
          locations: [...new Set(kept.flatMap((item) => item.locations))],
        };
    if (cross && (next.sourceIds.length < 2 || independentSourceCount(next.items) < 2)) continue;
    if (hidden.includes(`story:${story.id}`)) continue;
    out.push(next);
  }
  return out;
}

export function storyContaining(item: Item, stories: Story[]) {
  return stories.find((story) => story.items.some((entry) => entry.id === item.id));
}

/** Re-resolve a story from fresh board items after reclassify or refresh. */
export function refreshStory(story: Story, boardItems: Item[], pool: Story[]): Story | null {
  const byId = new Map(boardItems.map((item) => [item.id, item]));
  const items = story.items.map((row) => byId.get(row.id)).filter(Boolean) as Item[];
  if (!items.length) return null;
  const want = new Set(items.map((item) => item.id));
  const fromPool = pool.find(
    (candidate) =>
      candidate.items.length === items.length &&
      candidate.items.every((row) => want.has(row.id)),
  );
  if (fromPool) return fromPool;
  if (items.length === 1) return itemAsStory(items[0]);
  const clustered = clusterItems(items);
  return (
    clustered.find(
      (candidate) =>
        candidate.items.length === items.length &&
        candidate.items.every((row) => want.has(row.id)),
    ) ?? itemAsStory(items[0])
  );
}

export function situationLine(stories: Story[], sources: Source[]) {
  const places = [...new Set(stories.flatMap((s) => s.locations))].slice(0, 3);
  const topics = [...new Set(stories.flatMap((s) => s.topics))].slice(0, 3);
  const hottest = stories[0];
  const bits = [
    `${stories.length} ${stories.length === 1 ? "story" : "stories"}`,
    `${sources.filter((s) => s.enabled).length} layers`,
  ];
  if (places.length) bits.push(places.join(", "));
  if (topics.length) bits.push(topics.join(" · "));
  if (hottest && independentSourceCount(hottest.items) > 1) {
    bits.push(`most covered: ${hottest.title.slice(0, 72)}`);
  }
  return bits.join("  ·  ");
}
