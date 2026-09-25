import { cacheClearForRefresh } from "../cache";
import { mapPool } from "../http";
import { insertItems, listEnabledSources, listSourcesByIds, markFetched } from "../queries";

import { fetchSourceItems } from "./index";

export type RefreshResult = {
  layers: number;
  ok: number;
  failed: number;
  itemsAdded: number;
};

export async function refreshSources(ids?: number[], options?: { bustCache?: boolean }) {
  const sources = ids?.length ? listSourcesByIds(ids) : listEnabledSources();
  if (options?.bustCache !== false) {
    cacheClearForRefresh();
  }

  let ok = 0;
  let failed = 0;
  let itemsAdded = 0;

  await mapPool(sources, 4, async (source) => {
    try {
      const items = await fetchSourceItems(source);
      if (items.length) {
        insertItems(source.id, items);
        itemsAdded += items.length;
      }
      markFetched(source.id);
      ok += 1;
    } catch (error) {
      failed += 1;
      console.error(`refresh ${source.key}`, error);
    }
  });

  return { layers: sources.length, ok, failed, itemsAdded };
}
