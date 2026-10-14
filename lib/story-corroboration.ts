import type { Story } from "./cluster";
import { mineItem } from "./mine";
import { storyOrigins, type SyndicationReason } from "./syndication";
import { itemMatchesRising } from "./trends";
import type { Source } from "./types";

export type StoryCorroboration = {
  /** Independent origins after folding syndicated copies together. */
  sourceCount: number;
  /** Raw layer count, including syndicated copies. */
  layerCount: number;
  sourceNames: string[];
  /** One line per origin that absorbed copies, e.g. "Reuters wire: BBC, RTÉ". */
  syndicated: string[];
  rising: boolean;
  kevCves: string[];
};

const REASON_LABEL: Record<SyndicationReason, string> = {
  "same-url": "same link",
  wire: "wire copy",
  "same-text": "near-identical text",
};

export function storyCorroboration(
  story: Story,
  sources: Map<number, Source>,
  risingKeys: Set<string>,
  kevCveIds: Set<string>,
): StoryCorroboration {
  const nameOf = (id: number) => sources.get(id)?.name ?? "source";
  const origins = storyOrigins(story.items);
  const syndicated = origins
    .filter((origin) => origin.sourceIds.length > 1)
    .map((origin) => {
      const why = origin.wire ? `${origin.wire} wire` : origin.reasons.map((r) => REASON_LABEL[r]).join(", ");
      return `${why}: ${origin.sourceIds.map(nameOf).join(", ")}`;
    });
  const sourceNames = origins.map((origin) => nameOf(origin.sourceIds[0]));
  const rising = story.items.some((item) =>
    itemMatchesRising(item, risingKeys, sources.get(item.sourceId)),
  );
  const cves = new Set<string>();
  for (const item of story.items) {
    for (const cve of mineItem(item).cves) cves.add(cve.toUpperCase());
  }
  const kevCves = [...cves].filter((cve) => kevCveIds.has(cve));
  return {
    sourceCount: origins.length,
    layerCount: story.sourceIds.length,
    sourceNames,
    syndicated,
    rising,
    kevCves,
  };
}

export function kevCatalogSet(entries: { cveId: string }[]) {
  return new Set(entries.map((row) => row.cveId.toUpperCase()));
}