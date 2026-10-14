import { cacheClearForRefresh } from "../cache";
import { mergedIntelFeeds } from "../feed-overrides";
import { isAcledFeedUrl } from "../acled";
import { isGdeltDocUrl } from "../gdelt";
import { acledIngestEnabled, gdeltIngestEnabled } from "../ingest-flags";
import { backoffMs, pollIntervalMs } from "../fetch-schedule";
import { mapPool, withFetchContext } from "../http";
import { isRedditFeedUrl, isRedditRssFetchError, redditRssErrorDetail } from "../reddit";
import {
  deferSources,
  insertItems,
  listEnabledSources,
  listSourcesByIds,
  recentPublishTimes,
  recordFetchFailure,
  recordFetchSuccess,
  registerIntelFeeds,
  retireRedditRssSource,
} from "../queries";
import { notifyWatchAlerts, type WatchAlert } from "../watchlists";

import { gdeltCoolUntil, isGdeltRateLimitError, isGdeltTransientError } from "./gdelt";
import { fetchSourceItems } from "./index";

export type RefreshResult = {
  layers: number;
  ok: number;
  failed: number;
  itemsAdded: number;
  /** Layers whose upstream answered 304 Not Modified. */
  notModified: number;
  errors: string[];
};

export async function refreshSources(
  ids?: number[],
  options?: {
    bustCache?: boolean;
    /** Ask upstream conditionally even when the cached body is still fresh (scheduler). */
    revalidate?: boolean;
    skipGdelt?: boolean;
    skipReddit?: boolean;
    skipAcled?: boolean;
  },
): Promise<RefreshResult> {
  // Keep intel layer feed URLs in sync with lib/intel-feeds.ts (and overrides) without re-enabling disabled layers.
  registerIntelFeeds(mergedIntelFeeds(), false);

  let sources = ids?.length ? listSourcesByIds(ids) : listEnabledSources();
  const skipGdelt = options?.skipGdelt || !gdeltIngestEnabled();
  const skipAcled = options?.skipAcled || !acledIngestEnabled();
  if (skipGdelt) {
    sources = sources.filter((source) => !(source.feedUrl && isGdeltDocUrl(source.feedUrl)));
  }
  if (options?.skipReddit) {
    sources = sources.filter((source) => !(source.feedUrl && isRedditFeedUrl(source.feedUrl)));
  }
  if (skipAcled) {
    sources = sources.filter((source) => !(source.feedUrl && isAcledFeedUrl(source.feedUrl)));
  }
  if (options?.bustCache !== false) {
    cacheClearForRefresh();
  }

  let ok = 0;
  let failed = 0;
  let itemsAdded = 0;
  let notModified = 0;
  const errors: string[] = [];
  const alerts: WatchAlert[] = [];

  const gdelt = sources.filter((source) => source.feedUrl && isGdeltDocUrl(source.feedUrl));
  const rest = sources.filter((source) => !gdelt.includes(source));

  async function pull(source: (typeof sources)[number]) {
    try {
      const { value: items, outcomes } = await withFetchContext(
        { revalidate: options?.revalidate },
        () => fetchSourceItems(source),
      );
      const unchanged = outcomes.length > 0 && !outcomes.includes("fetched") && outcomes.includes("not_modified");
      let added = 0;
      if (unchanged) {
        notModified += 1;
      } else if (items.length) {
        const result = insertItems(source.id, items);
        added = result.created;
        itemsAdded += added;
        alerts.push(...result.alerts);
      }
      const interval = pollIntervalMs(source, recentPublishTimes(source.id));
      recordFetchSuccess(source.id, unchanged ? "not_modified" : "ok", added, Date.now() + interval);
      ok += 1;
    } catch (error) {
      failed += 1;
      let message = error instanceof Error ? error.message : "Refresh failed";
      if (source.feedUrl && isRedditFeedUrl(source.feedUrl) && isRedditRssFetchError(error)) {
        retireRedditRssSource(source.id, redditRssErrorDetail(error));
        message = redditRssErrorDetail(error);
      }
      const interval = pollIntervalMs(source, recentPublishTimes(source.id));
      recordFetchFailure(source.id, message, (failCount) => Date.now() + backoffMs(interval, failCount));
      const label = source.name?.trim() || source.key;
      if (errors.length < 6) errors.push(`${label}: ${message}`);
      if (isGdeltTransientError(error)) {
        console.warn(`refresh ${source.key}: ${message}`);
      } else {
        console.error(`refresh ${source.key}`, error);
      }
    }
  }

  await mapPool(rest, 4, pull);

  const cool = gdeltCoolUntil();
  const gdeltPulled = new Set<number>();
  if (gdelt.length && cool > Date.now()) {
    const secs = Math.ceil((cool - Date.now()) / 1000);
    failed += gdelt.length;
    errors.push(
      `GDELT: paused about ${secs}s after a rate limit. Leave other GDELT layers off, then Fetch now on one query.`,
    );
  } else {
    for (const source of gdelt) {
      if (gdeltCoolUntil() > Date.now()) {
        failed += 1;
        if (errors.length < 6) errors.push(`${source.name}: skipped — GDELT rate-limit cooldown`);
        continue;
      }
      gdeltPulled.add(source.id);
      await pull(source);
      if (errors.some((error) => isGdeltRateLimitError(new Error(error)) || /one request every 5 seconds/i.test(error))) {
        break;
      }
    }
  }
  const gdeltSkipped = gdelt.filter((source) => !gdeltPulled.has(source.id)).map((source) => source.id);
  deferSources(gdeltSkipped, Math.max(gdeltCoolUntil(), Date.now()) + 60_000);

  void notifyWatchAlerts(alerts);

  return { layers: sources.length, ok, failed, itemsAdded, notModified, errors };
}
