import { mineItem, matchVendorName } from "./mine";
import { bylinePeople, itemHasPerson, itemOrgs } from "./people";
import { resolvePlace } from "./places";
import type { TrendRow } from "./trends";
import type { Item, Source } from "./types";

export function itemMatchesTrendRow(
  item: Item,
  row: Pick<TrendRow, "kind" | "id">,
  source?: Source | null,
): boolean {
  if (row.kind === "topic") {
    return item.topics.includes(row.id) || item.tags.includes(row.id);
  }
  if (row.kind === "place") {
    const id = row.id.toLowerCase();
    return item.locations.some((loc) => resolvePlace(loc).toLowerCase() === id);
  }
  if (row.kind === "vendor") {
    return mineItem(item).vendors.some(
      (vendor) => (matchVendorName(vendor) ?? vendor).toLowerCase() === row.id.toLowerCase(),
    );
  }
  if (row.kind === "org") return itemOrgs(item).some((org) => org.name === row.id);
  if (bylinePeople(item, source).includes(row.id)) return true;
  return itemHasPerson(item, row.id, source);
}

export function countBoardItemsForTrend(
  items: Item[],
  sources: Map<number, Source>,
  row: Pick<TrendRow, "kind" | "id">,
) {
  let n = 0;
  for (const item of items) {
    if (itemMatchesTrendRow(item, row, sources.get(item.sourceId))) n += 1;
  }
  return n;
}
