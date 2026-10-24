# 05 — Places: precise matches, actors kept apart

Depends on: 01, 02, 03.

## Why

`PLACES` in `lib/classify.ts` is case-insensitive substring-of-word matching, so ordinary words pin stories to the map:

- `US`: `\bu\.?s\.a?\b` matches the word **us** ("Tell us what you think") → every ISC Stormcast is a US story (702 items carry US).
- `Taiwan` includes the bare word `strait` → Hormuz and Malacca stories land on Taiwan.
- `Indonesia` includes `java` (the language); `Turkey` matches the bird; `Ireland` matches `Shannon` (a first name) and lowercase `cork`; `India` matches `indian` (Indian Ocean, Native American).
- People and groups stand in for places: `putin` → Russia, `modi` → India, `macron` → France, `erdogan` → Turkey, `maduro` → Venezuela, `hamas` → Gaza, `hezbollah` → Lebanon, `houthi` → Yemen, `taliban` → Afghanistan, `idf` → Israel. A story about Putin's speech in Beijing is pinned to Russia **and** China.

`textHasPlace()` repeats the same regex at filter time on title + summary + extract.

## Design

Move the place table to `lib/place-rules.ts` (pure, client-safe):

```ts
export type PlaceRule = {
  name: string;                     // canonical, as used today ("US", "Ireland", "Taiwan Strait")
  strong: RegExp[];                 // match alone: proper names, case-sensitive where capitalisation matters
  /** Ambiguous words: count only when a context regex also matches the same text. */
  weak?: { re: RegExp; context: RegExp }[];
  vetoes?: RegExp[];                // phrases that are never this place
};

/** People and groups that imply a home place only when the item names no place at all. */
export const ACTOR_HOMES: { re: RegExp; place: string; label: string }[];

export function placesInText(text: string): string[];
```

Rules:

- **Case-sensitive** for short or ambiguous tokens: `US`, `U.S.`, `USA`, `UK`, `U.K.`, `EU`, `UN` (UN is not a place; leave it to diplomacy), `Cork`, `Turkey`, `Java`, `Niger`, `Chad`, `Georgia`, `Jordan`, `Victoria`.
- `United States`, `Washington, D.C.`, `White House`, `Pentagon` stay strong for US. `Washington` alone is weak (context: `D\.C\.|administration|officials|Congress|said`), veto `Washington Post|Washington State|University of Washington`.
- `Taiwan`: drop `strait`; keep `Taiwan`, `Taipei`, `Taiwan Strait`.
- `Indonesia`: `Java` weak with context `island|Indonesia|Jakarta|earthquake|volcano`.
- `Turkey`: `Türkiye`, `Ankara`, `Istanbul` strong; `Turkey` case-sensitive, veto `Turkey (?:prices|dinner|sandwich)|Thanksgiving turkey`.
- `Ireland`: `Shannon` weak with context `Airport|River|Clare|Limerick|estuary`; `Cork` case-sensitive.
- `India`: veto `Indian Ocean|Native Indian|American Indian|Indian Wells`.
- `Paris` veto `Paris Hilton|Paris Jackson`; `Sydney` veto `Sydney Sweeney`.
- Move `putin`, `kremlin` (Kremlin stays strong for Russia — it is a place), `modi`, `macron`, `erdogan`, `maduro`, `xi jinping`, `hamas`, `hezbollah`, `houthi`, `taliban`, `idf` into `ACTOR_HOMES`. `placesInText` adds an actor's home place **only** when no strong or weak place matched.
- `Belfast` keeps the Ireland/UK family behavior in `lib/places.ts` (no change).

## Steps

1. Create `lib/place-rules.ts`; make `classify()` locations and `textHasPlace()` both call `placesInText` / the same rules. Delete the old `PLACES` array.
2. Any new canonical place needs coordinates where `coordsForPlace` (`lib/geo.ts:144`) looks them up, or it cannot appear on the map. Check that every rule name resolves.
3. Bump `CLASSIFIER_VERSION` to 3 so task 03's backfill re-scores locations.
4. Empty `KNOWN_FAILING` in `lib/__tests__/places.test.ts`. Add cases for each veto and each actor home (actor-only title → home place; actor + other place → only the other place).
5. Corpus check (throwaway script, not committed): before/after counts for US, Taiwan, Indonesia, Turkey, Ireland, India, Russia, France; 10 samples of lost and gained rows each.

## Acceptance

- ISC Stormcast items have no place.
- "Putin speaks in Beijing" → China only. "Putin warns West" → Russia.
- Ireland pinned chip still matches Irish copy (`Irish`, `Dublin`, `Galway`, `Éire`) as `csmon.md` describes.
- `csmon.md` maps paragraph gains one sentence: "A leader or armed group places a story only when the story names no place."
