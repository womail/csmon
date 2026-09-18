import { mapPool } from "../http";
import { getSource, insertItems, listEnabledSources, markFetched } from "../queries";

import { fetchSourceItems } from "./index";

export async function refreshSources(ids?: number[]) {
  const sources = ids?.length
    ? ids.map((id) => getSource(id)).filter((s) => s !== null)
    : listEnabledSources();

  await mapPool(sources, 4, async (source) => {
    try {
      const items = await fetchSourceItems(source);
      if (items.length) insertItems(source.id, items);
      markFetched(source.id);
    } catch (error) {
      console.error(`refresh ${source.key}`, error);
    }
  });
}
