import { topicHintForSource } from "./source-types";
import { familyOfTopic, topicFamily } from "./topic-families";
import { SPORT_SUBTAGS, TOPIC_SUBTAGS, scoreTopics } from "./topic-rules";
import type { Item, Source } from "./types";

const SOURCE_HIT_RE = /source|feed|layer/i;

function prettyHit(hit: string) {
  return SOURCE_HIT_RE.test(hit) ? hit : `“${hit}”`;
}

/**
 * One line that says why a card carries a topic chip, from the same scorer the classifier uses.
 * Nothing is stored; the result is recomputed on hover.
 */
export function explainTopic(
  item: Pick<Item, "title" | "summary" | "topicsLocked">,
  topic: string,
  source?: Source | null,
): string {
  const key = topic.toLowerCase();
  const family = topicFamily(familyOfTopic(key)).label;
  if (item.topicsLocked) return `${family} · ${key} — you set this topic.`;
  const subtag =
    TOPIC_SUBTAGS.find((entry) => entry.tag === key) ??
    (SPORT_SUBTAGS.some((entry) => entry.tag === key) ? { parent: "sports" } : null);
  if (subtag) return `${family} · ${key} — finer tag under ${subtag.parent}.`;
  if (key === "reddit") return "Reddit — the post came from a Reddit layer.";
  const evidence = scoreTopics(item.title, item.summary, topicHintForSource(source)).find(
    (row) => row.topic === key,
  );
  if (!evidence?.hits.length) return `${family} · ${key}`;
  const hits = [...new Set(evidence.hits)].slice(0, 3).map(prettyHit).join(", ");
  return `${family} · ${key} — ${hits}`;
}
