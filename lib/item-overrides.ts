/** User topic overrides (right-click reclassify). The server lock is the source of truth; this is a cache. */
import { apiFetch } from "./api-client";

export const ITEM_OVERRIDES_KEY = "csmon.item-topic-overrides";

export type ItemTopicOverride = {
  topics: string[];
  tags?: string[];
  updatedAt: number;
};

export function loadItemTopicOverrides(): Record<string, ItemTopicOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ITEM_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ItemTopicOverride>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveItemTopicOverride(itemId: number, topics: string[], tags?: string[]) {
  const all = loadItemTopicOverrides();
  all[String(itemId)] = {
    topics: topics.slice(0, 8),
    tags: tags?.slice(0, 8),
    updatedAt: Date.now(),
  };
  window.localStorage.setItem(ITEM_OVERRIDES_KEY, JSON.stringify(all));
  return all;
}

export function clearItemTopicOverride(itemId: number) {
  const all = loadItemTopicOverrides();
  delete all[String(itemId)];
  window.localStorage.setItem(ITEM_OVERRIDES_KEY, JSON.stringify(all));
  return all;
}

export const ITEM_OVERRIDES_SYNCED_KEY = "csmon.item-topic-overrides-synced";

/** One-time push of browser-only overrides so the server locks them before re-scoring. */
export async function syncItemTopicOverrides() {
  if (typeof window === "undefined" || window.localStorage.getItem(ITEM_OVERRIDES_SYNCED_KEY)) return;
  const entries = Object.entries(loadItemTopicOverrides())
    .filter(([, row]) => row?.topics?.length)
    .slice(0, 500)
    .map(([id, row]) => ({ itemId: Number(id), topics: row.topics }));
  if (entries.length) {
    try {
      const res = await apiFetch("/api/items/reclassify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: entries }),
      });
      if (!res.ok) return;
    } catch {
      return;
    }
  }
  window.localStorage.setItem(ITEM_OVERRIDES_SYNCED_KEY, String(Date.now()));
}

export function applyTopicOverride<T extends { id: number; topics: string[]; tags: string[] }>(
  item: T,
  overrides: Record<string, ItemTopicOverride>,
): T {
  const row = overrides[String(item.id)];
  if (!row?.topics.length) return item;
  const next: T = { ...item, topics: row.topics };
  if (row.tags?.length) next.tags = row.tags;
  return next;
}
