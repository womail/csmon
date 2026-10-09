export type HypothesisTag = "supports" | "neutral" | "contradicts";

export const HYPOTHESIS_TAG_LABEL: Record<HypothesisTag, string> = {
  supports: "Supports",
  neutral: "Neutral",
  contradicts: "Contradicts",
};

const KEY = "csmon.hypothesis-tags";

type Store = Record<string, Record<string, HypothesisTag>>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(store));
}

export function getStoryHypothesisTag(filterId: string, storyId: string): HypothesisTag | null {
  return readStore()[filterId]?.[storyId] ?? null;
}

export function setStoryHypothesisTag(
  filterId: string,
  storyId: string,
  tag: HypothesisTag | null,
) {
  const store = readStore();
  const row = { ...(store[filterId] ?? {}) };
  if (tag) row[storyId] = tag;
  else delete row[storyId];
  if (Object.keys(row).length === 0) delete store[filterId];
  else store[filterId] = row;
  writeStore(store);
}
