# 11 — Command palette pivots, filter trail, and saving what you repeat

Depends on: 07, 08, 09, 10.

## Why

An investigation is a walk: topic → place → actor → story → back two steps → a different actor. csmon keeps the current view in the URL but has no memory of the walk, and the palette only reaches a short list of desks, places, sources, and people. Users also rebuild the same views by hand every morning.

## 1. Palette as the universal pivot

`components/monitor/command-palette.tsx` today indexes actions, 8 saved filters, desks, 12 places, 16 sources, watches, and 10 people.

- Index every facet value on the board (topics, families, subtags, places, people, orgs, vendors, CVEs, sources, categories, source types) with its count in range, plus saved filters, live filters, watches, open reports, and desks. Build the index in a new `lib/palette-index.ts` (pure) from the same data the facet picker uses (task 08).
- Each row shows a kind badge, label, count, and for people/orgs the role or attribution.
- Keys: **Enter** adds as filter · **Shift+Enter** opens the dossier (task 09) · **Alt+Enter** excludes · **Ctrl/⌘+Enter** opens a new watch prefilled with the token.
- Typing a known prefix (`place:`, `org:`, `type:`, `family:`) narrows to that kind.
- Ranking: exact prefix > word start > substring; ties by count, then by recent use (store the last 20 picks in `csmon.palette-recent`).
- Empty query shows **Recent** (last picks and trail entries, see below) followed by **Often with** suggestions for the current view (task 09).

## 2. Filter trail — `lib/filter-trail.ts`

```ts
export type TrailEntry = { at: number; query: string; summary: string; count: number };
export function pushTrail(entry: TrailEntry): void;    // sessionStorage csmon.trail, max 40, de-duplicates consecutive equal queries
export function trailBack(): TrailEntry | null;
export function trailForward(): TrailEntry | null;
export function listTrail(): TrailEntry[];
```

- Record a new entry when the board query string (desk + filters, excluding map camera and `item`) has been stable for 1.5 s.
- Investigation bar: **◀ ▶** buttons and a **Trail** dropdown listing entries as "Brief · war · Ukraine · 63 stories · 4 min ago". Picking one applies its query.
- Keys: `[` back, `]` forward (add to the `?` cheatsheet and `csmon.md` Keyboard paragraph).
- **Save trail to report**: from the Trail dropdown, appends a "Method" note to the open report listing the steps taken (summary lines with timestamps). Reuse the report highlight/notes mechanism; if reports have no free-text note type, add the steps as a highlight on the first story and mention it in the report UI.

## 3. Offer to save what the user repeats

- Keep visit counts per view signature (desk + sorted facet tokens, ignoring range and camera) in `localStorage` `csmon.view-visits` as `{ [signature]: { days: string[]; dismissed?: boolean } }` (store ISO dates, keep the last 10).
- When the same signature has been opened on **3 different days** within 14 days and is not already a live filter or saved filter, show one inline line under the Active row: "You open this view often. **Save as live filter** · Not now". Save opens the existing New filter flow prefilled with a suggested name from `lib/desk-from-item.ts` style naming ("war · Ukraine"). Not now sets `dismissed`.
- After saving a live filter, offer once: "Also alert me when new stories match? **Watch**", which creates a watch with `facetsToSearchLine` (task 08) and the same desk.

## Tests

`lib/__tests__/palette-index.test.ts` (ranking, prefix narrowing), `lib/__tests__/filter-trail.test.ts` (dedupe, back/forward bounds; mock `sessionStorage`), `lib/__tests__/view-visits.test.ts` (3-distinct-days rule, dismissal, ignores range and camera).

## Acceptance

- Ctrl+K → type "volt" → Volt Typhoon appears with its count; Shift+Enter opens its dossier.
- Walk five views, press `[` three times, then `]` once: the board lands on the expected view each time.
- Opening the same filtered view on three days surfaces the save prompt once; saving creates a live filter on the rail.
- `csmon.md`: Keyboard, palette, and investigation bar paragraphs updated.
