# 07 — People and organisations

Depends on: 03 (backfill hook), 06 (source type helps tell outlets from people).

## Why

The People desk mixes two things the user thinks about separately: **who wrote it** (bylines) and **who it is about** (people in the news). It also lists things that are not people at all. Stored person entities, top of the list: Donald Trump 754, **The New York Times 598**, **The New York Times en Español 394**, **MSRC Security Update Guide 272**, **CISA 201**, **AL-MONITOR: The Pulse of The Middle East 161**, **"site:brookings.edu" - Google News 158**, **The Verge 150**, … **rat king 🐀 👑 49**.

Causes:

- `lib/scrape/rss.ts` falls back to the **feed title** as `author` when an item has no creator.
- `personName()` (`lib/people.ts`) filters with a short hand-written outlet list, then accepts anything 3–40 characters.
- `"info@thehackernews.com (The Hacker News)"`, `"nhcwebmaster@noaa.gov (NHC Webmaster)"` and multi-author strings are not parsed.
- `itemHasPerson` matches a plain substring, so short names hit inside other words.
- Named people in copy come from a fixed list of 16 figures; organisations from a fixed list of 12 (`ORGS` in `lib/entities.ts`), and the UI never shows orgs. Threat actors (APT28, Volt Typhoon, LockBit) are exactly what a cyber user pivots on.

## Design

### Bylines — `lib/bylines.ts` (pure)

```ts
export type Byline = { people: string[]; outlet: string | null };
export function parseByline(raw: string | null | undefined, source?: { name?: string; type?: SourceType }): Byline;
export function looksLikePersonName(value: string): boolean;
```

- Strip `By `, `Written by `, trailing role text after ` - ` or `, ` when it is a title ("Senior Reporter").
- Split on ` and `, ` & `, `;`, and `, ` (only when each side looks like a name).
- `email (Label)` → outlet = Label when Label is not person-shaped; person = Label when it is.
- `looksLikePersonName`: 2–4 tokens; each token starts with an uppercase letter (allow `de`, `van`, `von`, `bin`, `al-`, `O'`, `Mc`); letters, hyphens, apostrophes, periods only; no digits or emoji; no token from an outlet word list (`news`, `times`, `post`, `guide`, `blog`, `feed`, `team`, `staff`, `desk`, `security`, `update`, `center`, `centre`, `webmaster`, `editor`, `editors`, `press`, `media`, `the`).
- If the value equals the source name, or the layer's type is not `outlet`/`blog`/`wire` and the value is not person-shaped → outlet.
- Ingest: `lib/scrape/rss.ts` stops using `feed.title` as the author fallback; it stores `null`.
- Backfill via task 03's batch (bump `CLASSIFIER_VERSION`): for each row, `author = parseByline(author).people.join(", ") || null`. Rewrite person entities for the row.

### People in the news — `lib/gazetteer/people.ts`

```ts
export type Figure = {
  name: string;             // "Volodymyr Zelensky"
  aliases: string[];        // ["Zelenskyy", "Zelenskiy"]
  surnameSafe?: boolean;    // surname alone is enough (Trump, Putin, Zelensky, Netanyahu, Macron, Starmer, Erdogan, Modi)
  role: string;             // "President of Ukraine"
  country?: string;         // canonical place name
  domain?: "politics" | "business" | "tech" | "security" | "sports";
};
```

- Move `WORLD_FIGURES` here and grow it to about 80 (G20 leaders, NATO/UN/EU heads, central bankers, major tech CEOs, heads of CISA/NCSC/FBI/NSA, defence ministers of countries in active wars).
- Role-anchored discovery for everyone else (precision first): a person-shaped name right after `President`, `Prime Minister`, `Minister`, `Chancellor`, `Secretary`, `Senator`, `Rep.`, `CEO`, `chief executive`, `spokesperson`, `General`, `Admiral`, or followed by `, the … minister/president/CEO`. Store as entity kind `person` with `extra = {"role":"…"}` (the `extra` column already exists).
- Surname-only matches count only for `surnameSafe` figures. Everyone else needs the full name or an alias.

### Organisations — `lib/gazetteer/orgs.ts`

```ts
export type OrgKind = "intl_org" | "agency" | "military" | "armed_group" | "threat_actor" | "ransomware" | "company";
export type Org = { name: string; aliases: string[]; kind: OrgKind; country?: string; note?: string };
```

Seed at least:

- **Threat actors** with vendor aliases: APT28 (Fancy Bear, Forest Blizzard, Sofacy), APT29 (Cozy Bear, Midnight Blizzard, Nobelium), Sandworm (Seashell Blizzard), Lazarus (Diamond Sleet), Kimsuky, Volt Typhoon, Salt Typhoon, Flax Typhoon, Silk Typhoon, Charming Kitten (Mint Sandstorm), MuddyWater, Scattered Spider (Octo Tempest), Turla (Secret Blizzard), FIN7. Country attribution comes from the Microsoft weather naming: Typhoon → China, Blizzard → Russia, Sandstorm → Iran, Sleet → North Korea.
- **Ransomware**: LockBit, ALPHV/BlackCat, Cl0p, Akira, Black Basta, Qilin, RansomHub, Play, Medusa, 8Base.
- **Agencies/CERTs**: CISA, NCSC, FBI, NSA, ENISA, CERT-EU, CERT-FR (ANSSI), BSI, CCCS, JPCERT, Europol, Interpol, NCSC Ireland.
- **International**: UN, NATO, EU, WHO, IAEA, OPEC, IMF, World Bank, ICC.
- **Armed groups**: Hamas, Hezbollah, Houthis, Taliban, Islamic State, al-Shabaab, RSF, Wagner / Africa Corps.

Replace `ORGS` in `lib/entities.ts` with this table. A threat actor never becomes a place; its `country` is shown as "attributed to Russia" in the UI and used as a connection (task 09), not a map pin.

## UI

1. **People desk** (`components/monitor/people-desk.tsx`) gets three tabs: **In the news** (figures and role-discovered people, default), **Organisations** (grouped by kind, threat actors first on cyber desks), **Bylines** (journalists, with their outlets). Each row: name, role or kind, count in range, a sparkline from `lib/trends.ts`, top two topics, sources. Keep right-click actions.
2. **Board filter**: new URL param `org` (one value) and typed `org:` / `person:` in `parseQueryLine`. `person:` is already promised in `live-filter-form.tsx`; implement it. `itemHasPerson` matches whole words and aliases only.
3. **Cards**: show up to two org chips (threat actors and armed groups first) next to vendor chips, same size as topic chips. Threat-actor chips get a distinct outline. Click filters; right-click offers Only / Exclude / Watch like other chips.
4. **Pulse**: orgs join topics/places/vendors/people in `trendKeys`.
5. **Command palette**: index orgs and the expanded people (task 11 widens this further).

## Acceptance

- People → In the news has no outlet, feed, or agency names. Bylines lists names such as "Sergiu Gatlan" and "Charlie Savage" with their outlets.
- `?org=APT28` returns stories that say Fancy Bear or Forest Blizzard.
- Unit tests: `lib/__tests__/bylines.test.ts` (each raw string from the evidence list maps to the expected people/outlet), `lib/__tests__/gazetteer.test.ts` (alias resolution, surname rules, actor never a place).
- `csmon.md`: People desk row and the graph diagram updated (`Org ─mentioned─ Item`, `Org ─attributed─ Place`).
