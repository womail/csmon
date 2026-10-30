import type { BoardFilters } from "./board-state";
import { isKnownTopic, itemHasTopic } from "./classify";
import { isDocumentItem } from "./documents";
import { matchesLane } from "./lanes";
import { isAdvisoryItem, itemHasVendor, mineItem } from "./mine";
import { itemMatchesAnyNest } from "./desk-nests";
import { itemHasPerson } from "./people";
import { isKnownPlace, itemHasPlace } from "./places";
import { itemMatchesQuery, parseQueryLine } from "./query-builder";
import type { Desk, Item, Source } from "./types";
import { parseFacetToken, type FacetInput } from "./facets";
import { orgByName } from "./gazetteer/orgs";
import { itemOrgs } from "./people";
import { sourceCategory } from "./source-types";
import { familiesForItem, itemInFamilies } from "./topic-families";

function itemHasOrg(item: Item, name: string) {
  const canonical = (orgByName(name)?.name ?? name).toLowerCase();
  return itemOrgs(item).some((org) => org.name.toLowerCase() === canonical);
}

function itemHasCve(item: Item, cve: string) {
  const needle = cve.toUpperCase();
  return mineItem(item).cves.some((row) => row.toUpperCase() === needle);
}

/** True when the item carries the facet; used for `not=` negations. */
export function itemMatchesFacet(item: Item, facet: FacetInput, source: Source | undefined): boolean {
  const v = facet.value;
  switch (facet.kind) {
    case "topic":
      return itemHasTopic(item, v);
    case "tag":
      return item.tags.includes(v.toLowerCase()) || item.topics.includes(v.toLowerCase());
    case "family":
      return familiesForItem(item).includes(v.toLowerCase() as never);
    case "place":
      return itemHasPlace(item, v);
    case "person":
      return itemHasPerson(item, v, source);
    case "org":
      return itemHasOrg(item, v);
    case "vendor":
      return itemHasVendor(item, v);
    case "cve":
      return itemHasCve(item, v);
    case "source": {
      const id = Number(v);
      if (Number.isFinite(id) && id > 0) return item.sourceId === id;
      const lower = v.toLowerCase();
      return Boolean(source && (source.name.toLowerCase().includes(lower) || source.handle?.toLowerCase() === lower));
    }
    case "stype":
      return source?.sourceType === v;
    case "category":
      return Boolean(source && sourceCategory(source).toLowerCase() === v.toLowerCase());
    case "origin":
      return Boolean(source?.origins.some((entry) => entry.reason === v));
    case "platform":
      return source?.platform === v;
    case "nest":
      return itemMatchesAnyNest(item, [v]);
    default:
      return false;
  }
}

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
  const negations = (filters.not ?? []).map(parseFacetToken).filter((row): row is FacetInput => Boolean(row));
  const stypes = filters.stype ?? [];
  const families = filters.fam ?? [];
  const cves = filters.cve ?? [];

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
    if (filters.org && !itemHasOrg(item, filters.org)) return false;
    if (stypes.length && !(source?.sourceType && (stypes as string[]).includes(source.sourceType))) return false;
    if (filters.cat && !(source && sourceCategory(source).toLowerCase() === filters.cat.toLowerCase())) return false;
    if (families.length && !itemInFamilies(item, families)) return false;
    if (cves.length && !cves.some((cve) => itemHasCve(item, cve))) return false;
    if (negations.some((facet) => itemMatchesFacet(item, facet, source))) return false;
    if (!itemMatchesAnyNest(item, filters.nest)) return false;
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
