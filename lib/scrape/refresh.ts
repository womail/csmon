import { cacheClearForRefresh } from "../cache";
import { mergedIntelFeeds } from "../feed-overrides";
import { isAcledFeedUrl } from "../acled";
import { isGdeltDocUrl } from "../gdelt";
import { mapPool } from "../http";
import { isRedditFeedUrl, isRedditRssFetchError, redditRssErrorDetail } from "../reddit";
import {
  insertItems,
  listEnabledSources,
  listSourcesByIds,
  markFetched,
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
  errors: string[];
};

export async function refreshSources(
  ids?: number[],
  options?: { bustCache?: boolean; skipGdelt?: boolean; skipReddit?: boolean; skipAcled?: boolean },
) {
  // Keep intel layer feed URLs in sync with lib/intel-feeds.ts (and overrides) without re-enabling disabled layers.
  registerIntelFeeds(mergedIntelFeeds(), false);

  let sources = ids?.length ? listSourcesByIds(ids) : listEnabledSources();
  if (options?.skipGdelt) {
    sources = sources.filter((source) => !(source.feedUrl && isGdeltDocUrl(source.feedUrl)));
  }
  if (options?.skipReddit) {
    sources = sources.filter((source) => !(source.feedUrl && isRedditFeedUrl(source.feedUrl)));
  }
  if (options?.skipAcled) {
    sources = sources.filter((source) => !(source.feedUrl && isAcledFeedUrl(source.feedUrl)));
  }
  if (options?.bustCache !== false) {
    cacheClearForRefresh();
  }

  let ok = 0;
  let failed = 0;
  let itemsAdded = 0;
  const errors: string[] = [];
  const alerts: WatchAlert[] = [];

  const gdelt = sources.filter((source) => source.feedUrl && isGdeltDocUrl(source.feedUrl));
  const rest = sources.filter((source) => !gdelt.includes(source));

  async function pull(source: (typeof sources)[number]) {
    try {
      const items = await fetchSourceItems(source);
      if (items.length) {
        const result = insertItems(source.id, items);
        itemsAdded += result.ids.length;
        alerts.push(...result.alerts);
      }
      markFetched(source.id);
      ok += 1;
    } catch (error) {
      failed += 1;
      let message = error instanceof Error ? error.message : "Refresh failed";
      if (source.feedUrl && isRedditFeedUrl(source.feedUrl) && isRedditRssFetchError(error)) {
        retireRedditRssSource(source.id, redditRssErrorDetail(error));
        message = redditRssErrorDetail(error);
      }
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
      await pull(source);
      if (errors.some((error) => isGdeltRateLimitError(new Error(error)) || /one request every 5 seconds/i.test(error))) {
        break;
      }
    }
  }

  void notifyWatchAlerts(alerts);

  return { layers: sources.length, ok, failed, itemsAdded, errors };
}
