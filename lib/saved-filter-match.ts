import type { BoardFilters } from "./board-state";
import { encodeQueryTree } from "./query-builder";
import type { SavedFilter } from "./saved-filters";
import { loadSavedFilters } from "./saved-filters";

function signature(filters: BoardFilters) {
  return JSON.stringify({
    desk: filters.desk,
    q: filters.q.trim(),
    topic: filters.topic,
    topics: [...filters.topics].sort(),
    place: filters.place,
    tags: [...filters.tags].sort(),
    range: filters.range,
    cross: filters.cross,
    stack: filters.stack,
    risk: filters.risk,
    vendor: filters.vendor,
    ransomware: filters.ransomware,
    layer: filters.layer,
    origin: filters.origin,
    platform: filters.platform,
    person: filters.person,
    rising: filters.rising,
    qb: encodeQueryTree(filters.qb),
  });
}

export function findMatchingSavedFilter(filters: BoardFilters): SavedFilter | null {
  const sig = signature(filters);
  for (const row of loadSavedFilters()) {
    if (signature(row.filters) === sig) return row;
  }
  return null;
}
