# 09 — Connections: suggest the next pivot before the user looks for it

Depends on: 05, 06, 07, 08.

## How the user connects things

Watching an analyst use csmon, the moves repeat:

- **Topic → where?** "War is up. Where?" → adds a place.
- **Place → who and what?** "Ireland. Which agencies, which vendors, which people?"
- **Vendor → exploited CVEs → my stack.** "Ivanti again. Is it in KEV? Do I run it?"
- **Threat actor → victims, CVEs, country.** "Volt Typhoon: which products, which sectors, attributed where?"
- **Story → everything it touches.** From one story, open each thing it names to see what else involves it.
- **Report → more of the same.** "Is there anything new that belongs in the briefing I'm writing?"

Today each step is a manual search. csmon already has all the data on the board (topics, places, vendors, CVEs, people, orgs after task 07, source types after task 06). This task computes what goes together and offers it.

## Engine — `lib/connections.ts` (pure, client-safe)

```ts
export type EntityRef = { kind: "topic" | "place" | "person" | "org" | "vendor" | "cve" | "category" | "stype"; value: string };

/** All entity refs for one item, computed once per item and memoised by item id. */
export function itemRefs(item: Item, source: Source | undefined): EntityRef[];

export type Connection = EntityRef & {
  together: number;   // stories in the focus set that carry this ref
  focus: number;      // stories in the focus set
  base: number;       // stories in the whole range that carry this ref
  lift: number;       // (together / focus) / (base / total)
};

/** What co-occurs with the focus set more than usual. Works on stories, so syndicated copies count once. */
export function connectionsFor(
  focusStories: Story[], allStories: Story[], opts?: { minTogether?: number; perKind?: number; exclude?: EntityRef[] },
): Connection[];
```

- Count at **story** level (`lib/cluster.ts` output), so ten wire copies of one event count once.
- Score = `together * log2(1 + lift)`; require `together >= 2` and `lift >= 1.3`. Drop refs already in the active facets. Return the top `perKind` (default 3) per kind, then sort by score.
- Memoise on the facet signature + range so it reruns only when the filter changes.

## UI

1. **Often with** row, under the Active row, whenever at least one facet is on. Up to 8 chips across kinds, e.g. `Ukraine 42`, `NATO 12`, `Volt Typhoon 5`, `CERT 9`. Each chip has the kind icon. Click adds the facet (AND). Alt-click (and right-click → Exclude) adds it negated. Tooltip: "42 of 63 stories in this view also mention Ukraine — 3.1× more often than across all stories in the range." Hidden on Patch, Reports, Flights.
2. **Connected** panel in Read in place (`components/monitor/reader.tsx`), above Similar articles: every person, org, place, vendor, and CVE in the story, each with "12 other stories in range" and a disclosure listing the top 3 headlines. Buttons per row: **Filter**, **Dossier**, **Watch**. Threat actors show "attributed to Russia" (task 07). Vendors show "2 in KEV · in your stack" when the vendor matches Options → stack.
3. **Entity dossier** — generalise the place and source dossier panes into `components/monitor/entity-pane.tsx` with `kind` + `value`. URL `?dossier=org:APT28` (parse/serialize in `lib/board-state.ts`). Sections:
   - Header: name, kind, role/aliases, attributed country, **Filter**, **Exclude**, **Watch**, **Save as live filter**, **Add all to report**.
   - Activity: sparkline over the range (reuse `lib/trends.ts` buckets) with today's count.
   - Stories: top by origin count.
   - Coverage: sources grouped by type — "2 CERTs · 1 vendor · 6 outlets" — each source clickable.
   - Connected: `connectionsFor` with this entity as the focus.
   Keep the existing place and source dossiers working by routing them through the new pane.
4. **Report and watch hints** on Brief/Scan cards: when a card shares an org, CVE, or vendor with a story already in the **open report**, show a small badge "Links to your report · APT28". When it matches an active watch, the existing watch hit chip already shows; keep it. Clicking the badge adds the story to the report.
5. **Cyber chain** in the vendor dossier: KEV CVEs for the vendor (from the loaded KEV catalog), EPSS where loaded, threat actors that co-occur with the vendor in range, and "In your stack" when Options → stack names the vendor.

## Tests

`lib/__tests__/connections.test.ts` with synthetic stories: lift math, syndicated duplicates counted once, active facets excluded, `minTogether` respected, stable ordering.

## Acceptance

- Filter `topic=war`: Often with offers the places and actors that dominate war coverage in the range, with counts that match clicking them.
- Open a story naming APT28 and Microsoft: Connected lists both with counts; Dossier opens `?dossier=org:APT28`, and **Copy link** reopens it.
- With a report open, a new matching story shows the "Links to your report" badge.
- No network calls added; the computation runs on the board's items.
- `csmon.md`: new paragraph **Connections** after **Syndication**, plus updates to the reader and dossier text.
