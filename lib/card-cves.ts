import type { Story } from "./cluster";
import { feedCvesForItem } from "./item-cves";
import type { Item } from "./types";

const MAX_CVE_CHIPS = 3;

export function boardCvesForItem(item: Pick<Item, "title" | "summary">): string[] {
  return feedCvesForItem(item).slice(0, MAX_CVE_CHIPS);
}

export function boardCvesForStory(story: Story): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of story.items) {
    for (const cve of feedCvesForItem(item)) {
      if (seen.has(cve)) continue;
      seen.add(cve);
      out.push(cve);
      if (out.length >= MAX_CVE_CHIPS) return out;
    }
  }
  return out;
}

/** Collect CVE IDs from visible board rows for EPSS batch fetch. */
export function collectBoardCveIds(
  viewDesk: string,
  items: Item[],
  stories: Story[],
  boardCap: number,
  kevCveIds: string[],
): string[] {
  const set = new Set<string>(kevCveIds);
  if (viewDesk === "scan") {
    for (const item of items.slice(0, boardCap)) {
      for (const cve of feedCvesForItem(item)) set.add(cve);
    }
  } else if (viewDesk !== "patch") {
    for (const story of stories.slice(0, boardCap)) {
      for (const item of story.items) {
        for (const cve of feedCvesForItem(item)) set.add(cve);
      }
    }
  }
  return [...set];
}
