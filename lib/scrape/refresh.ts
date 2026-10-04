import { cacheClearForRefresh } from "../cache";
import { mergedIntelFeeds } from "../feed-overrides";
import { mapPool } from "../http";
import {
  insertItems,
  listEnabledSources,
  listSourcesByIds,
  markFetched,
  registerIntelFeeds,
} from "../queries";
import { notifyWatchAlerts, type WatchAlert } from "../watchlists";

import { fetchSourceItems } from "./index";

export type RefreshResult = {
  layers: number;
  ok: number;
  failed: number;
  itemsAdded: number;
};

export async function refreshSources(ids?: number[], options?: { bustCache?: boolean }) {
  // Keep intel layer feed URLs in sync with lib/intel-feeds.ts (and overrides) without re-enabling disabled layers.
  registerIntelFeeds(mergedIntelFeeds(), false);

  const sources = ids?.length ? listSourcesByIds(ids) : listEnabledSources();
  if (options?.bustCache !== false) {
    cacheClearForRefresh();
  }

  let ok = 0;
  let failed = 0;
  let itemsAdded = 0;
  const alerts: WatchAlert[] = [];

  await mapPool(sources, 4, async (source) => {
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
      console.error(`refresh ${source.key}`, error);
    }
  });

  void notifyWatchAlerts(alerts);

  return { layers: sources.length, ok, failed, itemsAdded };
}
