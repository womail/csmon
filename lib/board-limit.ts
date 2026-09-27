/** Caps how many enabled-source items load onto the board (SQLite query LIMIT). */

export const DEFAULT_BOARD_ITEM_LIMIT = 500;
export const MIN_BOARD_ITEM_LIMIT = 100;
export const MAX_BOARD_ITEM_LIMIT = 10_000;

export function clampBoardItemLimit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BOARD_ITEM_LIMIT;
  return Math.min(MAX_BOARD_ITEM_LIMIT, Math.max(MIN_BOARD_ITEM_LIMIT, Math.floor(value)));
}

/** Server default from CSMON_ITEM_LIMIT, else 500. */
export function envBoardItemLimit(): number {
  const raw = Number(process.env.CSMON_ITEM_LIMIT?.trim());
  if (Number.isFinite(raw) && raw > 0) return clampBoardItemLimit(raw);
  return DEFAULT_BOARD_ITEM_LIMIT;
}

export function itemLimitFromRequest(request: Request): number {
  const q = Number(new URL(request.url).searchParams.get("itemLimit"));
  if (Number.isFinite(q) && q > 0) return clampBoardItemLimit(q);
  return envBoardItemLimit();
}

/** Append ?itemLimit= for browser → API calls. */
export function withItemLimitQuery(path: string, limit: number): string {
  const url = new URL(path, "http://local");
  url.searchParams.set("itemLimit", String(clampBoardItemLimit(limit)));
  return `${url.pathname}${url.search}`;
}
