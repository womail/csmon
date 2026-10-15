import type { Story } from "./cluster";
import type { Item } from "./types";

export type BoardSort = "newest" | "topic" | "tag" | "place" | "source";

export const BOARD_SORT_KEY = "csmon.board-sort";

export const BOARD_SORT_LABEL: Record<BoardSort, string> = {
  newest: "Newest",
  topic: "Topic",
  tag: "Tag",
  place: "Place",
  source: "Source",
};

export function primaryTag(item: Item) {
  const extra = item.tags.find((tag) => !item.topics.includes(tag));
  return extra ?? item.topics[0] ?? "other";
}

export function loadBoardSort(): BoardSort {
  if (typeof window === "undefined") return "newest";
  try {
    const raw = window.localStorage.getItem(BOARD_SORT_KEY);
    if (raw && raw in BOARD_SORT_LABEL) return raw as BoardSort;
  } catch {
    /* ignore */
  }
  return "newest";
}

export function saveBoardSort(sort: BoardSort) {
  window.localStorage.setItem(BOARD_SORT_KEY, sort);
}

function ts(item: Item) {
  return item.publishedAt ?? 0;
}

export function sortItems(items: Item[], sort: BoardSort): Item[] {
  const copy = [...items];
  if (sort === "newest") {
    copy.sort((a, b) => ts(b) - ts(a));
    return copy;
  }
  if (sort === "topic") {
    copy.sort((a, b) => {
      const ta = (a.topics[0] ?? "zzz").localeCompare(b.topics[0] ?? "zzz");
      return ta !== 0 ? ta : ts(b) - ts(a);
    });
    return copy;
  }
  if (sort === "tag") {
    copy.sort((a, b) => {
      const ta = primaryTag(a).localeCompare(primaryTag(b));
      return ta !== 0 ? ta : ts(b) - ts(a);
    });
    return copy;
  }
  if (sort === "place") {
    copy.sort((a, b) => {
      const pa = (a.locations[0] ?? "zzz").localeCompare(b.locations[0] ?? "zzz");
      return pa !== 0 ? pa : ts(b) - ts(a);
    });
    return copy;
  }
  copy.sort((a, b) => a.sourceId - b.sourceId || ts(b) - ts(a));
  return copy;
}

export function sortStories(stories: Story[], sort: BoardSort): Story[] {
  const copy = [...stories];
  if (sort === "newest") {
    copy.sort((a, b) => b.latestAt - a.latestAt);
    return copy;
  }
  if (sort === "topic") {
    copy.sort((a, b) => {
      const ta = (a.topics[0] ?? "zzz").localeCompare(b.topics[0] ?? "zzz");
      return ta !== 0 ? ta : b.latestAt - a.latestAt;
    });
    return copy;
  }
  if (sort === "tag") {
    copy.sort((a, b) => {
      const tag = (story: Story) => {
        const head = story.items[0];
        return head ? primaryTag(head) : story.topics[0] ?? "other";
      };
      const ta = tag(a).localeCompare(tag(b));
      return ta !== 0 ? ta : b.latestAt - a.latestAt;
    });
    return copy;
  }
  if (sort === "place") {
    copy.sort((a, b) => {
      const pa = (a.locations[0] ?? "zzz").localeCompare(b.locations[0] ?? "zzz");
      return pa !== 0 ? pa : b.latestAt - a.latestAt;
    });
    return copy;
  }
  copy.sort((a, b) => {
    const sa = a.sourceIds[0] ?? 0;
    const sb = b.sourceIds[0] ?? 0;
    return sa - sb || b.latestAt - a.latestAt;
  });
  return copy;
}

/** Group items by primary topic for section headers. */
export function groupItemsByTag(items: Item[]): { key: string; items: Item[] }[] {
  const map = new Map<string, Item[]>();
  for (const item of items) {
    const key = primaryTag(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, rows]) => ({ key, items: rows }));
}

export function groupItemsByTopic(items: Item[]): { key: string; items: Item[] }[] {
  const map = new Map<string, Item[]>();
  for (const item of items) {
    const key = item.topics[0] ?? "other";
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, rows]) => ({ key, items: rows }));
}

function storyGroupKey(story: Story, sort: BoardSort): string {
  if (sort === "topic") return story.topics[0] ?? "other";
  if (sort === "tag") {
    const head = story.items[0];
    return head ? primaryTag(head) : story.topics[0] ?? "other";
  }
  if (sort === "place") return story.locations[0] ?? "other";
  if (sort === "source") {
    const id = story.sourceIds[0];
    return id != null ? String(id) : "other";
  }
  return "other";
}

function storyTimeBand(latestAt: number, now = Date.now()): string {
  const age = now - latestAt;
  if (age <= 6 * 60 * 60 * 1000) return "Last 6 hours";
  const dayStart = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const today = dayStart(now);
  const storyDay = dayStart(latestAt);
  if (storyDay >= today) return "Today";
  if (storyDay >= today - 86400000) return "Yesterday";
  return "Earlier";
}

const TIME_BAND_ORDER = ["Last 6 hours", "Today", "Yesterday", "Earlier"];

/** Brief desk: time bands when sort is newest, else buckets by active sort key. */
export function groupStoriesForBrief(
  stories: Story[],
  sort: BoardSort,
  sources?: Map<number, { name: string }>,
): { key: string; stories: Story[] }[] {
  if (sort === "newest") {
    const map = new Map<string, Story[]>();
    for (const story of stories) {
      const key = storyTimeBand(story.latestAt);
      const bucket = map.get(key);
      if (bucket) bucket.push(story);
      else map.set(key, [story]);
    }
    return TIME_BAND_ORDER.filter((key) => map.has(key)).map((key) => ({
      key,
      stories: map.get(key)!,
    }));
  }
  const map = new Map<string, Story[]>();
  for (const story of stories) {
    let key = storyGroupKey(story, sort);
    if (sort === "source" && sources) {
      const id = story.sourceIds[0];
      key = id != null ? (sources.get(id)?.name ?? `source ${id}`) : "other";
    }
    const bucket = map.get(key);
    if (bucket) bucket.push(story);
    else map.set(key, [story]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, rows]) => ({ key, stories: rows }));
}
