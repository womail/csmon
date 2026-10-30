import { SPORT_SUBTAGS, TOPIC_SUBTAGS, type Topic } from "./topic-rules";

export type FamilyId =
  | "security"
  | "conflict"
  | "hazards"
  | "politics"
  | "economy"
  | "technology"
  | "health"
  | "sports"
  | "general";

export type TopicFamily = {
  id: FamilyId;
  label: string;
  topics: Topic[];
  subtags: string[];
  /** CSS custom property for the family colour (`app/globals.css`). */
  tone: string;
};

function subtagsOf(parents: Topic[]) {
  return TOPIC_SUBTAGS.filter((entry) => parents.includes(entry.parent)).map((entry) => entry.tag);
}

export const TOPIC_FAMILIES: TopicFamily[] = [
  { id: "security", label: "Security", topics: ["cyber"], subtags: subtagsOf(["cyber"]), tone: "--fam-security" },
  {
    id: "conflict",
    label: "Conflict",
    topics: ["war", "conflict", "unrest", "defense", "nuclear"],
    subtags: [],
    tone: "--fam-conflict",
  },
  {
    id: "hazards",
    label: "Hazards",
    topics: ["weather", "quake", "disaster", "climate"],
    subtags: subtagsOf(["weather", "quake", "disaster", "climate"]),
    tone: "--fam-hazards",
  },
  {
    id: "politics",
    label: "Politics",
    topics: ["politics", "diplomacy"],
    subtags: subtagsOf(["politics", "diplomacy"]),
    tone: "--fam-politics",
  },
  { id: "economy", label: "Economy", topics: ["markets", "energy"], subtags: [], tone: "--fam-economy" },
  { id: "technology", label: "Technology", topics: ["tech", "ai", "science"], subtags: [], tone: "--fam-technology" },
  { id: "health", label: "Health", topics: ["health"], subtags: [], tone: "--fam-health" },
  {
    id: "sports",
    label: "Sports",
    topics: ["sports"],
    subtags: SPORT_SUBTAGS.map((entry) => entry.tag),
    tone: "--fam-sports",
  },
  { id: "general", label: "General", topics: [], subtags: [], tone: "--fam-general" },
];

export const FAMILY_IDS: FamilyId[] = TOPIC_FAMILIES.map((family) => family.id);

const familyByTopic = new Map<string, FamilyId>();
for (const family of TOPIC_FAMILIES) {
  for (const topic of family.topics) familyByTopic.set(topic, family.id);
  for (const tag of family.subtags) familyByTopic.set(tag, family.id);
}

export function isFamilyId(value: unknown): value is FamilyId {
  return typeof value === "string" && (FAMILY_IDS as string[]).includes(value);
}

export function topicFamily(id: FamilyId): TopicFamily {
  return TOPIC_FAMILIES.find((family) => family.id === id) ?? TOPIC_FAMILIES[TOPIC_FAMILIES.length - 1];
}

/** Topic or subtag → family; source markers such as `reddit` and free text fall under General. */
export function familyOfTopic(topic: string): FamilyId {
  return familyByTopic.get(topic.toLowerCase()) ?? "general";
}

export function familiesForItem(item: { topics: string[] }): FamilyId[] {
  const out = new Set<FamilyId>();
  for (const topic of item.topics) {
    const family = familyByTopic.get(topic);
    if (family) out.add(family);
  }
  return out.size ? [...out] : ["general"];
}

export function itemInFamilies(item: { topics: string[] }, families: FamilyId[]): boolean {
  if (!families.length) return true;
  const mine = familiesForItem(item);
  return families.some((family) => mine.includes(family));
}

/** Order chips by family (table order), keeping the classifier's order inside a family. */
export function sortByFamily(topics: string[]): string[] {
  const rank = (topic: string) => FAMILY_IDS.indexOf(familyOfTopic(topic));
  return topics
    .map((topic, index) => ({ topic, index }))
    .sort((a, b) => rank(a.topic) - rank(b.topic) || a.index - b.index)
    .map((entry) => entry.topic);
}

/** Group a flat topic list by family for menus; empty families are dropped. */
export function groupByFamily(topics: string[]): { family: TopicFamily; topics: string[] }[] {
  const groups = new Map<FamilyId, string[]>();
  for (const topic of topics) {
    const id = familyOfTopic(topic);
    groups.set(id, [...(groups.get(id) ?? []), topic]);
  }
  return TOPIC_FAMILIES.filter((family) => groups.has(family.id)).map((family) => ({
    family,
    topics: groups.get(family.id) ?? [],
  }));
}

/** Items per family; an item with topics in two families counts in both. */
export function familyCounts(items: { topics: string[] }[]): Map<FamilyId, number> {
  const out = new Map<FamilyId, number>();
  for (const item of items) {
    for (const id of familiesForItem(item)) out.set(id, (out.get(id) ?? 0) + 1);
  }
  return out;
}
