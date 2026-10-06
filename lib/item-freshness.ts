import type { TimeRange } from "./types";
import { rangeStart } from "./time";
import type { Item } from "./types";

/** Article publication time only (never ingest / fetched_at). */
export function itemPublishTime(item: Pick<Item, "publishedAt">) {
  const ts = item.publishedAt;
  if (ts == null || !Number.isFinite(ts)) return null;
  return ts;
}

/** @deprecated Use itemPublishTime for display; fetched_at is not the article age. */
export function itemTimestamp(item: Item) {
  return itemPublishTime(item) ?? item.fetchedAt;
}

/** True when the article publish date falls inside the board time range. */
export function itemInTimeRange(item: Item, range: TimeRange, now = Date.now()) {
  const start = rangeStart(range);
  if (!start) return true;
  const ts = itemPublishTime(item);
  if (ts == null) return false;
  return ts >= start && ts <= now + 60_000;
}

export function freshnessLabel(item: Item, range: TimeRange): "fresh" | "stale" | "unknown" {
  if (!itemPublishTime(item)) return "unknown";
  return itemInTimeRange(item, range) ? "fresh" : "stale";
}
