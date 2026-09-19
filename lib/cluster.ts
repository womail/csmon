import { mineItem } from "./mine";
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

function jaccard(a: Set<string>, b: Set<string>) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

function itemKey(item: Item) {
  try {
    const parsed = new URL(item.url);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return item.url;
  }
}

export function itemAsStory(item: Item): Story {
  return {
    id: `item-${item.id}`,
    title: item.title,
    summary: item.summary,
    url: item.url,
    latestAt: item.publishedAt ?? item.fetchedAt,
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

  for (const item of items) {
    const toks = clusterTokens(item.title);
    const cves = new Set(mineItem(item).cves);
    const url = itemKey(item);
    let placed = false;
    for (const group of groups) {
      const overlap = [...toks].filter((t) => group.tokens.has(t)).length;
      const sameCve = [...cves].some((cve) => group.cves.has(cve));
      const sameUrl = group.urls.has(url);
      if (sameUrl || sameCve || jaccard(toks, group.tokens) >= 0.42 || (overlap >= 4 && jaccard(toks, group.tokens) >= 0.28)) {
        group.items.push(item);
        for (const t of toks) group.tokens.add(t);
        for (const cve of cves) group.cves.add(cve);
        group.urls.add(url);
        placed = true;
        break;
      }
    }
    if (!placed) {
      groups.push({ tokens: toks, cves, urls: new Set([url]), items: [item] });
    }
  }

  return groups
    .map((group) => {
      const sorted = [...group.items].sort(
        (a, b) => (b.publishedAt ?? b.fetchedAt) - (a.publishedAt ?? a.fetchedAt),
      );
      const head =
        sorted.find((item) => (item.summary ?? "").length > 80) ?? sorted[0];
      const topics = [...new Set(sorted.flatMap((i) => i.topics))];
      const locations = [...new Set(sorted.flatMap((i) => i.locations))];
      const summaries = [
        ...new Set(sorted.map((item) => item.summary).filter(Boolean) as string[]),
      ];
      return {
        id: `story-${sorted.map((item) => item.id).sort((a, b) => a - b).join("-")}`,
        title: head.title,
        summary: summaries[0] ?? head.summary,
        url: head.url,
        latestAt: sorted[0].publishedAt ?? sorted[0].fetchedAt,
        topics,
        locations,
        tags: [...new Set(sorted.flatMap((i) => i.tags))],
        items: sorted,
        sourceIds: [...new Set(sorted.map((i) => i.sourceId))],
      };
    })
    .sort((a, b) => {
      const sourceDelta = b.sourceIds.length - a.sourceIds.length;
      if (sourceDelta) return sourceDelta;
      return b.latestAt - a.latestAt;
    });
}

export function storyContaining(item: Item, stories: Story[]) {
  return stories.find((story) => story.items.some((entry) => entry.id === item.id));
}

export function situationLine(stories: Story[], sources: Source[]) {
  const places = [...new Set(stories.flatMap((s) => s.locations))].slice(0, 3);
  const topics = [...new Set(stories.flatMap((s) => s.topics))]
    .filter((t) => t !== "world")
    .slice(0, 3);
  const hottest = stories[0];
  const bits = [
    `${stories.length} ${stories.length === 1 ? "story" : "stories"}`,
    `${sources.filter((s) => s.enabled).length} layers`,
  ];
  if (places.length) bits.push(places.join(", "));
  if (topics.length) bits.push(topics.join(" · "));
  if (hottest && hottest.sourceIds.length > 1) {
    bits.push(`most covered: ${hottest.title.slice(0, 72)}`);
  }
  return bits.join("  ·  ");
}
