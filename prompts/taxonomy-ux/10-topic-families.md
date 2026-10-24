# 10 — Topic families and "why this topic"

Depends on: 02, 04, 08.

## Why

There are 19 flat topics plus league subtags. Several overlap in the user's head (war / conflict / defense / unrest / nuclear; weather / climate / disaster / quake), and the chip row lists them alphabetically with no hint of how they relate. Users also cannot see **why** csmon gave a card a topic, which makes a wrong chip feel random and a right one feel unearned.

## Design — `lib/topic-families.ts` (pure)

```ts
export type FamilyId = "security" | "conflict" | "hazards" | "politics" | "economy" | "technology" | "health" | "sports" | "general";

export const TOPIC_FAMILIES: {
  id: FamilyId;
  label: string;         // "Security", "Conflict", "Hazards", …
  topics: Topic[];       // members
  subtags?: string[];    // finer chips under the family
  tone: string;          // CSS custom property name for the family colour, e.g. "--fam-security"
}[];

export function familyOfTopic(topic: string): FamilyId;
export function familiesForItem(item: Pick<Item, "topics">): FamilyId[];
```

| Family | Topics | Subtags |
| --- | --- | --- |
| Security | cyber | ransomware, kev, phishing, zero-day, data-breach, supply-chain, ddos |
| Conflict | war, conflict, unrest, defense, nuclear | |
| Hazards | weather, quake, disaster, climate | flood, wildfire, storm, heat, tsunami, volcano |
| Politics | politics, diplomacy | election, sanctions |
| Economy | markets, energy | |
| Technology | tech, ai, science | |
| Health | health | |
| Sports | sports | the existing league subtags |
| General | (items with no topic) | |

Add the new subtags as signals in `lib/topic-rules.ts` (they only apply when the parent topic is assigned) and bump `CLASSIFIER_VERSION`.

## UI

1. **Family facet.** URL param `fam` (comma list), facet kind `family` from task 08, typed `family:security`. Matches when any member topic is present; `fam=general` matches items with no topic.
2. **More filters / facet picker**: browse rows become one row per family: the family name (click = family facet) followed by its topic chips and subtags with counts. Empty topics are hidden.
3. **Card topic chips** get a 6px dot in the family colour (define `--fam-*` in `app/globals.css` for both light and dark palettes; keep contrast within the existing palette). Order chips by family, then by classifier score.
4. **Why this topic.** Hovering a topic chip on a card or in the reader shows the evidence from `scoreTopics` (task 02): "Security · cyber — CVE id, vulnerability, CERT source". For a locked topic (task 03): "You set this topic." Compute on the client from title + summary + source hint; nothing is stored.
5. **Reclassify** submenu and **Tune → Topics** list group by family.
6. **Home**: keep the four situation lanes. Under the lanes, a single **Families** strip shows count per family for the range with ▲/▼ from Pulse; click applies the family facet. This gives one glance at the shape of the day.
7. **Pulse**: add a family filter at the top (All, Security, Conflict, …) that limits trend rows to that family's topics, subtags, and the places/orgs that co-occur with it.

## Tests

`lib/__tests__/topic-families.test.ts`: every known topic belongs to exactly one family; `fam=general` matches empty topics; subtags only appear with their parent.

## Acceptance

- More filters reads as eight short family rows.
- Hovering a chip explains it in one line.
- `?fam=security,conflict` survives **Copy link**.
- `csmon.md`: topic chip paragraph explains families, the colour dot, and the hover explanation.
