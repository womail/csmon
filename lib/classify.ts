import { placesInText, textMatchesPlace } from "./place-rules";
import {
  SPORT_SUBTAGS,
  TOPIC_RULES,
  TOPIC_SUBTAGS,
  isSportsHint,
  isWeatherHint,
  knownSubtagNames,
  scoreTopics,
  topicRuleNames,
  topicSubtags,
  type TopicHint,
} from "./topic-rules";

export type { TopicHint } from "./topic-rules";

export type Classification = {
  topics: string[];
  locations: string[];
  tags: string[];
};

export function sportSubtags(text: string): string[] {
  return SPORT_SUBTAGS.filter(({ re }) => re.test(text)).map(({ tag }) => tag);
}

export function sportSubtagNames() {
  return SPORT_SUBTAGS.map((entry) => entry.tag);
}

export function isSportSubtag(name: string) {
  const needle = name.trim().toLowerCase();
  return SPORT_SUBTAGS.some((entry) => entry.tag === needle);
}

export function isTopicSubtag(name: string) {
  const needle = name.trim().toLowerCase();
  return knownSubtagNames().includes(needle);
}

export function textLooksLikeSports(text: string) {
  return scoreTopics(text, null).some((row) => row.topic === "sports");
}

/** Intel RSS layers in the sports pack (`lib/intel-feeds.ts`). */
export const SPORTS_INTEL_HANDLES = new Set([
  "bbc-sport",
  "bbc-football",
  "guardian-sport",
  "espn",
  "nyt-sports",
  "sky-sports",
]);

const SPORTS_FEED_RE =
  /feeds\.bbci\.co\.uk\/sport|theguardian\.com\/sport|espn\.com\/espn|skysports\.com|nyt.*Sports\.xml|\/sport\/.*rss|\/sport\.xml/i;

export function isSportsFeedUrl(feedUrl: string | null | undefined) {
  if (!feedUrl) return false;
  return SPORTS_FEED_RE.test(feedUrl);
}

export function isSportsSource(hint: { handle?: string | null; feedUrl?: string | null }) {
  return isSportsHint(hint);
}

function defaultSportSubtag(hint: { handle?: string | null; feedUrl?: string | null }) {
  if (hint.handle === "bbc-football") return "soccer";
  const feed = hint.feedUrl ?? "";
  if (/\/sport\/football|football\/rss/i.test(feed)) return "soccer";
  if (/\/nfl\b|\/nfl\//i.test(feed)) return "nfl";
  if (/\/nba\b|\/nba\//i.test(feed)) return "basketball";
  if (/\/mlb\b|\/mlb\//i.test(feed)) return "baseball";
  if (/\/nhl\b|\/nhl\//i.test(feed)) return "hockey";
  return null;
}

/** Intel RSS layers in the hazard pack that are official weather/warning feeds. */
export const WEATHER_INTEL_HANDLES = new Set(["nws-alerts", "met-eireann", "metoffice-uk", "nhc-atlantic"]);

export function isWeatherSource(hint: { handle?: string | null; feedUrl?: string | null }) {
  return isWeatherHint(hint);
}

/** NWS-style headlines and CAP alert URLs — not cyber advisories. */
export function textLooksLikeOfficialWeatherAlert(text: string) {
  if (/\bby nws\b|\bnational weather service\b/i.test(text)) return true;
  if (/api\.weather\.gov\/alerts|alerts\.weather\.gov/i.test(text)) return true;
  if (/\bnws\b/i.test(text) && /\b(?:advisory|warning|watch|statement)\b/i.test(text)) return true;
  return /\b(?:flood|flash flood|severe thunderstorm|tornado|hurricane|typhoon|tropical storm|winter storm|heat|wind|wind chill|red flag|special weather|small craft|dense fog|frost|freeze|gale|high surf|rip current|coastal flood|lake wind|blizzard|ice storm|dust storm|special marine|beach hazards|storm surge)\s+(?:advisory|warning|watch|statement)\b/i.test(
    text,
  );
}

function isSportTag(tag: string) {
  return tag === "sports" || SPORT_SUBTAGS.some((entry) => entry.tag === tag);
}

/** Drop a stored cyber tag when the row is an NWS/weather product. */
export function withoutWeatherCyberTags(topics: string[], tags: string[], text: string) {
  if (!textLooksLikeOfficialWeatherAlert(text)) return { topics, tags };
  const keep = (tag: string) => tag !== "cyber" && tag !== "weather" && !isSportTag(tag);
  return {
    topics: ["weather", ...topics.filter(keep)].slice(0, 6),
    tags: [...new Set(["weather", ...tags.filter(keep)])].slice(0, 8),
  };
}

function leadWith(classified: Classification, topic: string, drop: (tag: string) => boolean): Classification {
  const topics = [topic, ...classified.topics.filter((t) => t !== topic && !drop(t))].slice(0, 6);
  const tags = [...new Set([topic, ...classified.tags.filter((t) => t !== topic && !drop(t))])].slice(0, 8);
  return { ...classified, topics, tags };
}

export function applyWeatherSourceTopics(
  classified: Classification,
  hint: { handle?: string | null; feedUrl?: string | null },
  text = "",
): Classification {
  if (isWeatherSource(hint) || textLooksLikeOfficialWeatherAlert(text)) {
    return leadWith(classified, "weather", (tag) => tag === "cyber" || isSportTag(tag));
  }
  return classified;
}

export function applySourceTopics(
  classified: Classification,
  hint: { handle?: string | null; feedUrl?: string | null },
): Classification {
  if (!isSportsSource(hint)) return classified;
  const next = leadWith(classified, "sports", () => false);
  const inferred = defaultSportSubtag(hint);
  if (inferred && !next.tags.includes(inferred)) next.tags = [...next.tags, inferred].slice(0, 8);
  return next;
}

export function sortStoryTopics(topics: string[]) {
  const counts = new Map<string, number>();
  for (const topic of topics) counts.set(topic, (counts.get(topic) ?? 0) + 1);
  return [...counts.keys()].sort((a, b) => {
    if (a === "sports") return -1;
    if (b === "sports") return 1;
    const diff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    return diff || a.localeCompare(b);
  });
}

function build(title: string, summary: string | null | undefined, hint?: TopicHint | null): Classification {
  const text = `${title} ${summary ?? ""}`;
  const topics: string[] = scoreTopics(title, summary, hint)
    .map((row) => row.topic as string)
    .slice(0, 6);
  const locations = placesInText(text).slice(0, 6);
  const subs = topicSubtags(text, topics);
  let classified: Classification = {
    topics,
    locations,
    tags: [...new Set([...topics, ...subs])].slice(0, 8),
  };
  if (hint) {
    const feed = `${hint.feedUrl ?? ""} ${hint.handle ?? ""}`;
    if (/reddit/i.test(feed)) classified = leadWith(classified, "reddit", () => false);
    if (/acled/i.test(feed) && !classified.topics.includes("conflict")) {
      classified = leadWith(classified, "conflict", () => false);
    }
    classified = applySourceTopics(classified, hint);
    classified = applyWeatherSourceTopics(classified, hint, text);
  } else if (textLooksLikeOfficialWeatherAlert(text)) {
    classified = leadWith(classified, "weather", (tag) => tag === "cyber" || isSportTag(tag));
  }
  return classified;
}

/** Classify free text (dossier copy, extracts). */
export function classify(text: string, hint?: TopicHint | null): Classification {
  return build(text, null, hint);
}

export function classifyText(text: string) {
  return classify(text).tags;
}

/** Ingest entry: title counts more than summary; the source hint adds a prior. */
export function classifyItem(title: string, summary?: string | null, hint?: TopicHint | null): Classification {
  return build(title, summary, hint);
}

export function textHasTopic(text: string, topic: string) {
  const needle = topic.trim().toLowerCase();
  if (!needle) return true;
  if (TOPIC_RULES.some((rule) => rule.topic === needle)) {
    return scoreTopics(text, null).some((row) => row.topic === needle);
  }
  const sub = [...SPORT_SUBTAGS, ...TOPIC_SUBTAGS].find((entry) => entry.tag === needle);
  if (sub) return sub.re.test(text);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

const EXTRA_TOPICS = ["reddit"];

export function isKnownTopic(name: string) {
  const needle = name.trim().toLowerCase();
  return (topicRuleNames() as string[]).includes(needle) || EXTRA_TOPICS.includes(needle);
}

export function knownTopicTags() {
  return [...topicRuleNames(), ...EXTRA_TOPICS];
}

/** Topic tags available in the reclassify menu (stable order). */
export function listClassifyTopics() {
  return knownTopicTags();
}

/**
 * Stored topics are the answer for known topics and subtags (so a chip, a lane, and a filter agree).
 * A free-text topic the user typed still matches by word in the copy.
 */
export function itemHasTopic(
  item: {
    title: string;
    summary?: string | null;
    url?: string;
    topics: string[];
    tags: string[];
    extractText?: string | null;
  },
  topic: string | null,
) {
  if (!topic) return true;
  const needle = topic.trim().toLowerCase();
  if (item.topics.includes(needle) || item.tags.includes(needle)) return true;
  if (isKnownTopic(needle) || isTopicSubtag(needle)) return false;
  const text = `${item.title} ${item.summary ?? ""} ${item.extractText ?? ""}`;
  return textHasTopic(text, needle);
}

export function textHasPlace(text: string, place: string) {
  if (!place.trim()) return true;
  return textMatchesPlace(text, place);
}
