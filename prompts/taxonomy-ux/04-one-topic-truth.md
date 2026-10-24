# 04 — One answer for "is this item about X?"

Depends on: 02, 03 (stored topics must be fresh first).

## Why

Three keyword systems decide topics today, and they disagree:

1. `classify()` at ingest → `items.topics` / `items.tags`.
2. `itemHasTopic()` (`lib/classify.ts`) → stored topics **or** the topic regex re-run against title + summary + **page extract** + **URL** at filter time. A long extract almost always contains "who", "attack", or "market", so filters re-add the false positives that task 02 removed.
3. `SITUATION_LANES` (`lib/lanes.ts`) → its own regexes for the Home lanes (the War lane matches the word "unrest" and "missile").

The user sees a topic chip on a card, clicks it, and gets a different set of items than the chip promised. Home lanes, map lane buttons, Brief, and Pulse also disagree.

## Steps

1. `itemHasTopic(item, topic)`:
   - Known topic (`isKnownTopic`) or known subtag → `item.topics.includes(topic) || item.tags.includes(topic)` and nothing else.
   - Unknown free-text topic typed by the user (`topic:foo`) → keep the whole-word text match on title + summary + extract.
   - Callers must pass items **after** `applyTopicOverride` (check `lib/board-item-filter.ts` and the `monitor.tsx` pipeline around `applyBoardItemFilters`).
2. `lib/lanes.ts`: delete the `re` fields. `matchesLane(item, lane)` becomes stored-topic membership:
   - weather ← `weather`
   - quake ← `quake`
   - war ← `war`
   - unrest ← `unrest`
   Keep `label` and `hint`. Update `components/monitor/dashboard.tsx`, `map-tools.tsx`, `lib/story-markers.ts`, `lib/situation-brief.ts` if they read `re`.
3. `lib/trends.ts` `trendKeys` and `lib/search-suggest.ts` read stored topics only.
4. Story level (`lib/cluster.ts`): a story's topics are the union of its items' stored topics, ordered by how many items carry each. Keep `sortStoryTopics` semantics but without the `world` special case (task 02 removed `world`).
5. Add `lib/__tests__/topic-truth.test.ts`: an item whose extract contains "who" and "attack" but whose stored topics are `["cyber"]` does **not** match `health` or `conflict`; a free-text topic still matches by word.

## Acceptance

- Clicking a topic chip on a card always shows that card in the result.
- The Home War lane count equals the number of in-range stories with stored topic `war`.
- Map lane buttons (All / Weather / Quakes / War / Unrest) and Home lanes give the same counts for the same range.
- `csmon.md` → Home / hazards: replace "Lanes stay filled even on older items by matching copy, not only stored topic tags" with "Lanes use the stored topics from the classifier. Reclassify a story to move it between lanes."
