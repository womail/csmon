export const VIEW_VISITS_KEY = "csmon.view-visits";

export type VisitRow = { days: string[]; dismissed?: boolean };
export type VisitMap = Record<string, VisitRow>;

const WINDOW_DAYS = 14;
const NEEDED_DAYS = 3;

/** Desk + sorted facet tokens. Range and map camera are left out on purpose. */
export function viewSignature(desk: string, tokens: string[]): string {
  return [desk, ...[...new Set(tokens.map((t) => t.toLowerCase()))].sort()].join("|");
}

export function isoDay(at: number) {
  return new Date(at).toISOString().slice(0, 10);
}

export function recordVisit(map: VisitMap, signature: string, at = Date.now()): VisitMap {
  const day = isoDay(at);
  const row = map[signature] ?? { days: [] };
  if (row.days.includes(day)) return map;
  return { ...map, [signature]: { ...row, days: [...row.days, day].slice(-10) } };
}

/** True when the view was opened on 3 distinct days within 14 days and the user has not said "Not now". */
export function shouldOfferSave(map: VisitMap, signature: string, at = Date.now()): boolean {
  const row = map[signature];
  if (!row || row.dismissed) return false;
  const cutoff = isoDay(at - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return row.days.filter((day) => day >= cutoff).length >= NEEDED_DAYS;
}

export function dismissVisit(map: VisitMap, signature: string): VisitMap {
  return { ...map, [signature]: { ...(map[signature] ?? { days: [] }), dismissed: true } };
}

export function loadVisits(): VisitMap {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(VIEW_VISITS_KEY) ?? "{}") as VisitMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveVisits(map: VisitMap) {
  if (typeof window === "undefined") return;
  const entries = Object.entries(map).slice(-200);
  window.localStorage.setItem(VIEW_VISITS_KEY, JSON.stringify(Object.fromEntries(entries)));
}
