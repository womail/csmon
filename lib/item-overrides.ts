/** User topic overrides (right-click reclassify). Merged over stored item topics in the UI. */

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
