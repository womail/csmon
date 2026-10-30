import type { Item } from "./types";

/** Home and map lanes. Membership is the stored classifier topic; reclassify a story to move it. */
export const SITUATION_LANES = [
  { id: "weather", label: "Bad weather", hint: "Storms, floods, heat, and official warnings" },
  { id: "quake", label: "Earthquakes", hint: "Quakes, aftershocks, and tsunami watches" },
  { id: "war", label: "War", hint: "Combat, invasion, and front-line reporting" },
  { id: "unrest", label: "Civil unrest", hint: "Protests, riots, coups, and martial law" },
] as const;

export type SituationLane = (typeof SITUATION_LANES)[number]["id"];

export function matchesLane(item: Pick<Item, "topics" | "tags">, lane: SituationLane) {
  return item.topics.includes(lane) || item.tags.includes(lane);
}

export function lanesForItem(item: Pick<Item, "topics" | "tags">) {
  return SITUATION_LANES.filter((lane) => matchesLane(item, lane.id)).map((lane) => lane.id);
}
