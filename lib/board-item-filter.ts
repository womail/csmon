import type { BoardFilters } from "./board-state";
import { isKnownTopic, itemHasTopic } from "./classify";
import { isDocumentItem } from "./documents";
import { matchesLane } from "./lanes";
import { isAdvisoryItem, itemHasVendor, mineItem } from "./mine";
import { itemHasPerson } from "./people";
import { isKnownPlace, itemHasPlace } from "./places";
import { itemMatchesQuery, parseQueryLine } from "./query-builder";
import type { Desk, Item, Source } from "./types";

export type BoardItemFilterContext = {
  viewDesk: Desk;
  /** Override desk topics/tags (custom desk URL params). Defaults to filters.topics / filters.tags. */
  filterTopics?: string[];
  filterTags?: string[];
  displayItemIds?: number[] | null;
  triageHidden?: string[];
};

function itemKey(id: number) {
  return `item:${id}`;
}

/** Apply board chip/search/query filters (not rising — apply that separately). */
export function applyBoardItemFilters(
  items: Item[],
  filters: BoardFilters,
  byId: Map<number, Source>,
  ctx: BoardItemFilterContext,
): Item[] {
  const filterTopics = ctx.filterTopics ?? filters.topics;
  const filterTags = ctx.filterTags ?? filters.tags;
  const triageHidden = ctx.triageHidden ?? [];
  const parsedLine = parseQueryLine(filters.q);
  const q = parsedLine.text.trim().toLowerCase();
  const needMine = filters.ransomware || Boolean(q);

  return items.filter((item) => {
    const source = byId.get(item.sourceId);
    if (filters.layer && item.sourceId !== filters.layer) return false;
    if (filters.origin && !source?.origins.some((entry) => entry.reason === filters.origin)) {
      return false;
    }
    if (filters.platform && source?.platform !== filters.platform) return false;
    if (ctx.viewDesk === "advisories" && !isAdvisoryItem(item, source)) return false;
    if (
      ctx.viewDesk === "weather" &&
      !matchesLane(item, "weather") &&
      !itemHasTopic(item, "weather")
    ) {
      return false;
    }
    if (ctx.viewDesk === "documents" && !isDocumentItem(item)) return false;
    if (filters.topic) {
      if (isKnownPlace(filters.topic) && !isKnownTopic(filters.topic)) {
        if (!itemHasPlace(item, filters.topic)) return false;
      } else if (!itemHasTopic(item, filters.topic)) {
        return false;
      }
    }
    if (filterTopics.length && !filterTopics.some((name) => itemHasTopic(item, name))) return false;
    if (
      filterTags.length &&
      !filterTags.some((name) => item.tags.includes(name) || item.topics.includes(name))
    ) {
      return false;
    }
    if (ctx.displayItemIds?.length && !ctx.displayItemIds.includes(item.id)) return false;
    if (filters.place && !itemHasPlace(item, filters.place)) return false;
    if (filters.person && !itemHasPerson(item, filters.person, source)) return false;
    if (triageHidden.includes(itemKey(item.id))) return false;
    if (filters.vendor && !itemHasVendor(item, filters.vendor)) return false;
    if (needMine) {
      const mined = mineItem(item);
      if (filters.ransomware && !mined.ransomware) return false;
      if (
        q &&
        !`${item.title} ${item.summary ?? ""} ${item.extractText ?? ""} ${source?.name ?? ""} ${item.locations.join(" ")} ${mined.cves.join(" ")} ${item.iocs?.join(" ") ?? ""}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
    }
    if (!itemMatchesQuery(item, parsedLine.tree, source)) return false;
    if (!itemMatchesQuery(item, filters.qb, source)) return false;
    return true;
  });
}
