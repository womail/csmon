/** Show only a chosen set of board items (display-only mode). */

export const DISPLAY_COLLECTION_KEY = "csmon.display-collection";

export type DisplayCollection = {
  itemIds: number[];
  label: string;
  updatedAt: number;
};

export function loadDisplayCollection(): DisplayCollection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DISPLAY_COLLECTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DisplayCollection;
    if (!parsed?.itemIds?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDisplayCollection(collection: DisplayCollection | null) {
  if (!collection?.itemIds.length) {
    window.localStorage.removeItem(DISPLAY_COLLECTION_KEY);
    return;
  }
  window.localStorage.setItem(DISPLAY_COLLECTION_KEY, JSON.stringify(collection));
}

export function clearDisplayCollection() {
  window.localStorage.removeItem(DISPLAY_COLLECTION_KEY);
}
