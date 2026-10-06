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
