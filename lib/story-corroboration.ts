import type { Story } from "./cluster";
import { mineItem } from "./mine";
import { itemMatchesRising } from "./trends";
import type { Item, Source } from "./types";

export type StoryCorroboration = {
  sourceCount: number;
  sourceNames: string[];
  rising: boolean;
  kevCves: string[];
};

export function storyCorroboration(
  story: Story,
  sources: Map<number, Source>,
  risingKeys: Set<string>,
  kevCveIds: Set<string>,
): StoryCorroboration {
  const sourceNames = story.sourceIds
    .map((id) => sources.get(id)?.name ?? "source")
    .filter(Boolean);
  const rising = story.items.some((item) =>
    itemMatchesRising(item, risingKeys, sources.get(item.sourceId)),
  );
  const cves = new Set<string>();
  for (const item of story.items) {
    for (const cve of mineItem(item).cves) cves.add(cve.toUpperCase());
  }
  const kevCves = [...cves].filter((cve) => kevCveIds.has(cve));
  return {
    sourceCount: story.sourceIds.length,
    sourceNames,
    rising,
    kevCves,
  };
}

export function kevCatalogSet(entries: { cveId: string }[]) {
  return new Set(entries.map((row) => row.cveId.toUpperCase()));
}
