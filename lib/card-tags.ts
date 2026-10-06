import type { Story } from "./cluster";
import type { Item } from "./types";

export function uniquePlaces(places: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const place of places) {
    const key = place.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(place);
  }
  return out;
}

/** Topic/tag chips for cards — skip tags that duplicate a location (e.g. brazil vs Brazil). */
export function itemTopicChips(item: Item) {
  const locKeys = new Set(item.locations.map((p) => p.trim().toLowerCase()));
  const seen = new Set<string>();
  const chips: string[] = [];
  for (const raw of [...item.topics, ...item.tags]) {
    const tag = raw.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key) || locKeys.has(key)) continue;
    seen.add(key);
    chips.push(tag);
  }
  return chips;
}

export function storyTopicChips(story: Story) {
  const locKeys = new Set(story.locations.map((p) => p.trim().toLowerCase()));
  const seen = new Set<string>();
  const chips: string[] = [];
  for (const raw of [...story.topics, ...story.tags]) {
    const tag = raw.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key) || locKeys.has(key)) continue;
    seen.add(key);
    chips.push(tag);
  }
  return chips;
}
