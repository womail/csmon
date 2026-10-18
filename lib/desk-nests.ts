import { isSportSubtag, sportSubtagNames } from "./classify";

const LABEL: Record<string, string> = {
  nfl: "NFL",
  nba: "NBA",
  mlb: "MLB",
  nhl: "NHL",
  mls: "MLS",
  f1: "F1",
  gaa: "GAA",
  soccer: "Soccer",
  rugby: "Rugby",
  cricket: "Cricket",
  tennis: "Tennis",
  golf: "Golf",
  basketball: "Basketball",
  baseball: "Baseball",
  hockey: "Hockey",
};

export function nestLabel(value: string) {
  const key = value.trim().toLowerCase();
  if (LABEL[key]) return LABEL[key];
  return key.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function itemMatchesNest(
  item: { title: string; summary?: string | null; tags: string[]; topics: string[] },
  term: string,
) {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  if (item.tags.some((tag) => tag.toLowerCase() === needle)) return true;
  if (item.topics.some((tag) => tag.toLowerCase() === needle)) return true;
  const hay = `${item.title} ${item.summary ?? ""}`;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, "i").test(hay);
}

/** Empty selection shows the whole desk. One or more terms show anything that matches any of them. */
export function itemMatchesAnyNest(
  item: { title: string; summary?: string | null; tags: string[]; topics: string[] },
  nest: string[],
) {
  if (!nest.length) return true;
  return nest.some((term) => itemMatchesNest(item, term));
}

export type DeskFacet = {
  value: string;
  label: string;
  count: number;
};

/** Tags already on this desk's items, sport codes first. */
export function suggestDeskFacets(
  items: { tags: string[]; topics: string[] }[],
  deskTopic: string | null,
): DeskFacet[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const keys = new Set([...item.tags, ...item.topics].map((tag) => tag.trim().toLowerCase()).filter(Boolean));
    for (const key of keys) {
      if (deskTopic && key === deskTopic) continue;
      if (key === "sports" && deskTopic === "sports") continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const sportOrder = sportSubtagNames();
  const sport = sportOrder.filter((tag) => (counts.get(tag) ?? 0) > 0);
  // A sports desk already offers its leagues. Other topics that leaked onto those items
  // (health, conflict) would crowd the row the user uses for NFL, Soccer, Chelsea.
  const rest =
    deskTopic === "sports"
      ? []
      : [...counts.entries()]
          .filter(([tag, count]) => !isSportSubtag(tag) && tag !== "sports" && tag !== deskTopic && count >= 2)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([tag]) => tag);
  return [...sport, ...rest].map((value) => ({
    value,
    label: nestLabel(value),
    count: counts.get(value) ?? 0,
  }));
}
