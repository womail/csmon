# 02 — Scored topic classifier

Depends on: 01.

## Why

`lib/classify.ts` gives an item a topic if **any** keyword in one big regex appears anywhere in title + summary. One stray word is enough, so common English words decide topics: "who" → health, "attack" → conflict, "defender" → sports, "bills"/"jets"/"chiefs" → NFL, "summit" → diplomacy, "market" → markets. See the evidence list in `README.md`.

## Design

Replace "any keyword" with **evidence that adds up**.

```ts
// lib/topic-rules.ts  (new, pure, client-safe — no server imports)
export type Topic =
  | "weather" | "quake" | "war" | "unrest" | "conflict" | "cyber" | "markets" | "ai" | "tech"
  | "energy" | "climate" | "health" | "politics" | "diplomacy" | "science" | "nuclear"
  | "defense" | "disaster" | "sports";

export type Signal = {
  re: RegExp;        // keep each regex small: one idea per signal
  weight: 1 | 2 | 3; // 3 = decisive alone, 2 = strong, 1 = weak (needs company)
  label: string;     // short human text for "why this topic", e.g. "CVE id"
};

export type TopicRule = {
  topic: Topic;
  signals: Signal[];
  /** If any of these match, this topic is not assigned (unless a weight-3 signal also matched). */
  vetoes?: { re: RegExp; label: string }[];
  /** Minimum score to assign. Default 2. */
  threshold?: number;
};
```

```ts
// lib/classify.ts
export type TopicHint = {
  handle?: string | null;
  feedUrl?: string | null;
  /** Source category from task 06; optional until then. */
  category?: string | null;
  language?: string | null;
};

export type TopicEvidence = { topic: Topic; score: number; hits: string[] };

export function scoreTopics(title: string, summary: string | null | undefined, hint?: TopicHint): TopicEvidence[];
export function classifyItem(title: string, summary?: string | null, hint?: TopicHint): Classification;
```

Scoring:

- For each rule, add the weight of every **distinct** signal that matches. A signal that matches in the **title** counts ×1.5 (round down at the end).
- Assign the topic when `score >= threshold` and no veto matched (a weight-3 hit overrides vetoes).
- Return topics sorted by score, capped at 6. `hits` holds the `label`s that fired; task 10 shows them as "Why this topic".
- **Source prior** (from `hint`): add +2 to the source's home topic (sports layers → sports, weather layers → weather, security/CERT/vendor layers → cyber). For security layers, apply a −2 to `sports`, `health`, `conflict`, and `war` unless a weight-3 signal for those topics fired. Keep `isSportsSource` / `isWeatherSource` as the hint source for now; task 06 adds `category`.
- **No fallback topic.** Stop pushing `"world"` when nothing scores. An item with no topic has `topics: []`. Grep for every `"world"` use (`lib/classify.ts`, `lib/dive.ts`, `lib/link.ts`, `lib/desk-from-item.ts`, `lib/trends.ts`, `lib/cluster.ts`, `lib/scrape/acled.ts`, `lib/scrape/reddit-oauth.ts`) and every place that reads `topics[0]`; make each one handle an empty list. The UI shows such items under the label **General** (task 10).
- Keep `tags` = topics + subtags (sport leagues today; task 10 adds cyber and hazard subtags) so existing filters and cards keep working. **Place names never go into `tags`.**
- Keep `stripCyberWhenWeatherHeadline`, `applyWeatherSourceTopics`, `applySourceTopics` behavior, but fold them into the scorer via `hint`. Their exported names may stay as thin wrappers so callers compile.
- Call sites to pass `hint`: `lib/scrape/rss.ts` (`asItems` has `fallbackUrl`), `lib/queries.ts` `insertItems` (has `source`), `lib/scrape/bsky.ts`, `lib/scrape/gdelt.ts`, `lib/scrape/acled.ts`, `lib/scrape/reddit-oauth.ts`, `lib/dive.ts`.

## Rule changes (minimum set)

Write each topic as several small signals. These are the specific fixes the evidence demands; add whatever else the golden cases need.

| Topic | Change |
| --- | --- |
| health | `WHO` **case-sensitive** (`/\bWHO\b/`) weight 2, `World Health Organization` 3. Remove lowercase `who`. `virus` weight 1 with veto when cyber words are present (`malware|ransomware|trojan|computer virus`). `hospital` weight 1. `outbreak`, `pandemic`, `epidemic`, `cholera`, `measles`, `mpox`, `vaccine` weight 2. |
| conflict | Drop bare `\battack` and `drone`. Add kinetic signals: `airstrike`, `shelling`, `missile strike`, `drone strike`, `killed in`, `soldiers`, `militants`, `armed group`, `casualties` (weight 2), `troops`, `ceasefire` (weight 2). Veto when `cyber` scored ≥3 and no kinetic signal matched. |
| war | `war` as a word only with a conflict context word nearby or a place from the conflict list; veto `chip war`, `price war`, `culture war`, `trade war`, `star wars`, `war room`. Drop `combat` alone (veto `combat (?:fraud|scams?|slop|misinformation|climate)`). `occupation` weight 1. |
| diplomacy | `UN` / `U.N.` **case-sensitive**, `United Nations` 3, `NATO` 2, `envoy`, `embassy`, `treaty`, `ambassador` 2, `summit` 1 (veto when sports scored). Remove lowercase `un`. |
| sports | Remove `defender`, `striker`, `cycling`, `athletics`, `golf` from the generic list; keep them as weight-1 signals. League/competition names are weight 2–3. Team nicknames move to weight 1 and only count with another sports signal or a sports source: `bills`, `jets`, `chiefs`, `commanders`, `cardinals`, `giants`, `eagles`, `lions`, `bears`, `panthers`, `saints`, `titans`, `raiders`, `rams`, `falcons`, `browns`, `colts`, `bucks`, `nets`, `suns`, `warriors`, `heat`. `Miami Heat` stays weight 3. |
| sport subtags | Same rule: a subtag is only added when `sports` is assigned. `heat` without `Miami` never adds basketball. `century`, `bowler` only with cricket context. `eagle`, `birdie` only with golf context. `qualifying` only with `f1|grand prix|motogp`. |
| markets | `market` alone weight 1 (veto `christmas market`, `job market` → keep as markets only with `hiring|jobs report|unemployment` weight 2). `stocks`, `nasdaq`, `S&P 500`, `yields`, `inflation`, `recession`, `GDP`, `Fed` (case-sensitive) weight 2. |
| politics | `bill` only as `\b(?:the|a|tax|spending|appropriations?) bills?\b` or `bill (?:passed|passes|vote)`. `president` weight 1 (veto `president of (?:product|engineering|sales)`, `vice president,`). `election`, `parliament`, `Congress`, `Senate`, `minister`, `sanctions` weight 2. |
| tech | `google`, `apple`, `microsoft` weight 1 (a vendor name alone is not "tech"). `chip`, `semiconductor`, `startup`, `smartphone` weight 2. |
| energy | `gas` only as `natural gas|gas prices?|gas supply|LNG`; veto `tear gas|nerve gas|gas attack`. `oil` only as `oil (?:price|prices|output|exports?|supply|field)|crude|OPEC`. |
| science | `study` and `research` weight 1. `NASA`, `telescope`, `physicists?`, `peer-reviewed`, `journal Nature`, `quantum` weight 2. Security vendor research blogs get the security source prior, so "research" alone stops tagging them. |
| defense | Add `fighter jets?`, `scrambled? jets`, `air force`, `navy`, `army`, `Pentagon`, `DoD` (case-sensitive) weight 2; veto `navy blue`. |
| disaster | `collapse` only with `building|bridge|mine|dam`; `explosion` only with `killed|injured|blast|plant|factory`. |
| cyber | Add weight-3 signals: `CVE-\d{4}-\d+`, `ZDI-\d+-\d+`, `SVD-\d{4}-\d+`, `GHSA-`, `zero-day`, `ransomware`, `KEV`, `Patch Tuesday`. French/Spanish: `vulnérabilit`, `vulnerabilidad`, `faille`. `exploit` weight 2; `hack` weight 1 (veto `life hack|hackathon`). |

Language: when `hint.language` is not `en` (or the title has French/Spanish markers like ` dans `, ` de la `, ` vulnérabilité`), skip the weight-1 English common-word signals entirely.

## Steps

1. Create `lib/topic-rules.ts` with the rules above. Keep `SPORT_SUBTAGS` and `PLACES` where they are for now (task 05 moves places).
2. Rewrite `classify()` / `classifyItem()` in `lib/classify.ts` on top of `scoreTopics`. Keep `knownTopicTags()`, `isKnownTopic()`, `listClassifyTopics()`, `sportSubtags()` exports working.
3. Thread `hint` through every call site listed above.
4. Remove rows from `KNOWN_FAILING` in `lib/__tests__/classify.test.ts` as they pass. **Target: the set is empty.** If a case is genuinely ambiguous, change the case (and say why in the commit message notes), do not weaken the rule.
5. Add `lib/__tests__/topic-rules.test.ts` with unit checks for scoring: title weighting, veto override by weight 3, source prior, language skip.
6. Measure on the real corpus with a throwaway script (do not commit it) that loads `data/csmon.sqlite` read-only, re-scores every item, and prints for each topic: before count, after count, 10 random items that **lost** the topic, 10 that **gained** it. Paste that table into your report. Read the samples; tune until the losses are false positives and the gains are true.

## Acceptance

- `pnpm test` green with `KNOWN_FAILING` empty in `classify.test.ts`.
- Corpus report shows `health` mostly gone from security advisories, `conflict` gone from ZDI/vendor advisories, no `world` topic, and `sports` absent from security layers.
- New items ingested by a refresh get the new topics (stored rows change in task 03).
- `csmon.md`: replace any wording that says items always get a topic with: "Topics come from a scored classifier (`lib/topic-rules.ts`). An item with no strong signal has no topic and appears under General."
