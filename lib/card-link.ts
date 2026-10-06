import { boardQueryString, type BoardFilters } from "./board-state";

export function cardUrlForItem(filters: BoardFilters, itemId: number, origin = "") {
  const base = "/";
  const qs = boardQueryString({ ...filters, focusItem: itemId });
  const host = origin || (typeof window !== "undefined" ? window.location.origin : "");
  return `${host}${base}${qs}`;
}

export async function copyCardLink(filters: BoardFilters, itemId: number) {
  const url = cardUrlForItem(filters, itemId);
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return url;
  }
  return url;
}
