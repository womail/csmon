import type { Item } from "./types";

export const SITUATION_LANES = [
  {
    id: "weather",
    label: "Bad weather",
    hint: "Storms, floods, heat, and official warnings",
    re: /\b(storm|blizzard|tornado|cyclone|typhoon|hurricane|flood|heatwave|wildfire|severe weather|weather warning|weather watch|winter storm|thunderstorm|hail|landfall|evacuation order)\b/i,
  },
  {
    id: "quake",
    label: "Earthquakes",
    hint: "Quakes, aftershocks, and tsunami watches",
    re: /\b(earthquake|aftershock|seismic|magnitude|m [4-9]\.\d|tsunami watch|tsunami warning)\b/i,
  },
  {
    id: "war",
    label: "War",
    hint: "Combat, invasion, and front-line reporting",
    re: /\b(war|warfare|invasion|airstrike|frontline|occupation|combat|missile|troop|shelling|battlefield|ceasefire)\b/i,
  },
  {
    id: "unrest",
    label: "Civil unrest",
    hint: "Protests, riots, coups, and martial law",
    re: /\b(protest|protester|riot|rioting|coup|martial law|demonstration|uprising|civil unrest|looting|curfew|clashes)\b/i,
  },
] as const;

export type SituationLane = (typeof SITUATION_LANES)[number]["id"];

export function itemText(item: Pick<Item, "title" | "summary" | "topics" | "tags">) {
  return `${item.title} ${item.summary ?? ""} ${item.topics.join(" ")} ${item.tags.join(" ")}`;
}

export function matchesLane(
  item: Pick<Item, "title" | "summary" | "topics" | "tags">,
  lane: SituationLane,
) {
  if (item.topics.includes(lane) || item.tags.includes(lane)) return true;
  const def = SITUATION_LANES.find((entry) => entry.id === lane);
  return def ? def.re.test(itemText(item)) : false;
}

export function lanesForItem(item: Pick<Item, "title" | "summary" | "topics" | "tags">) {
  return SITUATION_LANES.filter((lane) => matchesLane(item, lane.id)).map((lane) => lane.id);
}
