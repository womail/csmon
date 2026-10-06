import type { BoardFilters } from "./board-state";
import { normalizeBoardFilters } from "./board-state";
import { primaryTag } from "./board-sort";
import type { Item } from "./types";
import type { Story } from "./cluster";

const LABEL_MAX = 32;

export function guessDeskTitleFromItem(item: Item): string {
  const place = item.locations[0];
  const topic = item.topics[0];
  const tag = primaryTag(item);
  if (place && topic && topic !== "world") return `${topic} · ${place}`.slice(0, LABEL_MAX);
  if (place) return place.slice(0, LABEL_MAX);
  if (topic && topic !== "world") return topic.slice(0, LABEL_MAX);
  if (tag && tag !== "world") return tag.slice(0, LABEL_MAX);
  const words = item.title.trim().split(/\s+/).slice(0, 4).join(" ");
  return words.slice(0, LABEL_MAX) || "My desk";
}

export function filtersFromItem(item: Item, base: BoardFilters): BoardFilters {
  const topics = [...new Set(item.topics.filter((t) => t && t !== "world"))].slice(0, 6);
  const tags = [...new Set(item.tags.filter((t) => !topics.includes(t)))].slice(0, 6);
  return normalizeBoardFilters({
    ...base,
    topic: topics[0] ?? null,
    place: item.locations[0] ?? base.place,
    topics,
    tags,
    q: "",
    layer: item.sourceId,
  });
}

export function filtersFromStory(story: Story, base: BoardFilters): BoardFilters {
  const head = story.items[0];
  if (!head) {
    return normalizeBoardFilters({
      ...base,
      topic: story.topics[0] ?? null,
      place: story.locations[0] ?? null,
      topics: story.topics.slice(0, 6),
      tags: story.tags.slice(0, 6),
    });
  }
  return filtersFromItem(head, base);
}

export function displayOnlyIdsFromStory(story: Story): number[] {
  return [...new Set(story.items.map((item) => item.id))];
}
