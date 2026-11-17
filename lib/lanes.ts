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

const STORMCAST = /\bstormcast\b/i;
const STORM_CENTER = /\binternet storm center\b/i;
/** A weather event, not the word "storm" inside a security name. */
const WEATHER_EVENT =
  /\b(?:floods?|flooding|flash floods?|hurricanes?|tornado(?:es)?|typhoons?|cyclones?|blizzards?|heat ?waves?|wildfires?|droughts?|thunderstorms?|landfalls?|(?:winter|tropical|severe|ice|snow|rain) storms?|storm (?:warning|watch|advisory)|severe weather|national weather service|weather (?:warning|watch|advisory)|gales?)\b/i;

export type LaneStory = {
  topics: string[];
  title: string;
  summary?: string | null;
  items: Pick<Item, "topics" | "tags" | "title" | "summary">[];
};

/** Lane membership, with Bad weather closed to cyber podcasts and cyber items that are not a weather event. */
export function storyInLane(story: LaneStory, lane: SituationLane) {
  const member = story.topics.includes(lane) || story.items.some((item) => matchesLane(item, lane));
  if (!member || lane !== "weather") return member;
  const text = [story.title, story.summary ?? "", ...story.items.flatMap((item) => [item.title, item.summary ?? ""])].join(
    "\n",
  );
  if (STORMCAST.test(text)) return false;
  const cyber =
    story.topics.includes("cyber") ||
    story.items.some((item) => item.topics.includes("cyber") || item.tags.includes("cyber"));
  if ((cyber || STORM_CENTER.test(text)) && !WEATHER_EVENT.test(text)) return false;
  return true;
}
