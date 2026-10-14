import { isAcledFeedUrl } from "./acled";
import { isGdeltDocUrl } from "./gdelt";
import { isRedditFeedUrl } from "./reddit";
import type { Source } from "./types";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

export const SCHEDULE_FLOOR_MS = 10 * MIN;
const SCHEDULE_CEILING_MS = 4 * HOUR;
const BACKOFF_CEILING_MS = 12 * HOUR;

/** Upstreams with their own rate rules get a fixed cadence. */
function fixedInterval(source: Pick<Source, "feedUrl" | "platform">): number | null {
  const feed = source.feedUrl ?? "";
  if (feed && isAcledFeedUrl(feed)) return 6 * HOUR;
  if (feed && isGdeltDocUrl(feed)) return 30 * MIN;
  if (feed && isRedditFeedUrl(feed)) return 20 * MIN;
  if (source.platform === "bluesky") return 15 * MIN;
  return null;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Poll about twice per typical gap between posts: a wire feed that posts every 10 minutes is
 * checked every 10 (the floor); a blog that posts daily is checked every 4 hours.
 */
export function pollIntervalMs(
  source: Pick<Source, "feedUrl" | "platform">,
  publishTimesDesc: number[],
): number {
  const fixed = fixedInterval(source);
  if (fixed) return fixed;
  if (publishTimesDesc.length < 3) return HOUR;
  const gaps: number[] = [];
  for (let i = 1; i < publishTimesDesc.length; i++) {
    const gap = publishTimesDesc[i - 1] - publishTimesDesc[i];
    if (gap > 0) gaps.push(gap);
  }
  if (!gaps.length) return HOUR;
  return Math.min(SCHEDULE_CEILING_MS, Math.max(SCHEDULE_FLOOR_MS, median(gaps) / 2));
}

export function backoffMs(intervalMs: number, failCount: number) {
  return Math.min(BACKOFF_CEILING_MS, intervalMs * 2 ** Math.min(failCount, 6));
}
