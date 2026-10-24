# 08 — One facet model for every filter

Depends on: 06 and 07 (new filter kinds exist).

## Why

The same constraint can be set five ways (chip, typed prefix in `q`, Query builder `qb`, Tune form, desk nest) and appears in different places, or nowhere:

- `topic` vs `topics[]` vs `tags[]` vs `nest[]` all filter topics.
- **Exclude** on a chip appends `-source:…` to the search text (`handleChipMenuAction`, `monitor.tsx` ~1230), so it hides inside the search box.
- `filterSummaryLine` (`components/monitor/investigation-bar.tsx`) omits `topics`, `tags`, `nest`, `rising`, `cross`, `layer`.
- Switching a built-in desk keeps most filters without saying so (`changeDesk`, `monitor.tsx` ~2438).
- CVE chips set the free-text query instead of a filter.

The user should be able to look at one row and know every reason an item is hidden, and remove any of them with one click.

## Design — `lib/facets.ts` (pure)

```ts
export type FacetKind =
  | "text" | "topic" | "family" | "tag" | "place" | "person" | "org" | "vendor" | "cve"
  | "source" | "stype" | "category" | "origin" | "platform"
  | "rising" | "cross" | "ransomware" | "risk" | "stack" | "nest" | "rule";

export type Facet = {
  kind: FacetKind;
  value: string;          // "Ireland", "cyber", "12" (layer id), "cert"
  negate?: boolean;
  label: string;          // what the chip shows: "Ireland", "not Sports", "Layer: CISA alerts"
  token: string;          // typed form: place:Ireland, -topic:sports, type:cert
  from: "url" | "typed" | "desk" | "rule";
};

export function facetsFromFilters(filters: BoardFilters, ctx: { sources: Map<number, Source> }): Facet[];
export function addFacet(filters: BoardFilters, facet: Omit<Facet, "label" | "token" | "from">): BoardFilters;
export function removeFacet(filters: BoardFilters, facet: Facet): BoardFilters;
export function toggleFacet(filters: BoardFilters, facet: Omit<Facet, "label" | "token" | "from">): BoardFilters;
/** Typed tokens in q that map to a URL facet move out of q into their param. Free text stays in q. */
export function promoteTypedTokens(filters: BoardFilters): BoardFilters;
export function facetsToSearchLine(facets: Facet[]): string;
```

- **URL format stays compatible.** `facetsFromFilters` reads the existing `BoardFilters`; `addFacet`/`removeFacet` write the existing params. Add params only for things that had none: `xtopic`, `xplace`, `xsource`, … are **not** needed — use one new param `not` holding comma-separated negated tokens (`not=topic:sports,source:12`). Parse it in `parseBoardFilters` and apply in `board-item-filter.ts`. Exclude actions write here instead of into `q`. Old URLs with `-topic:` inside `q` keep working (the parser already handles them) and are shown as negated facets with `from: "typed"`.
- `topic` (single) and `topics[]` collapse into one list in the facet view. Keep both URL params for compatibility; `addFacet` writes `topics` when one is already present, otherwise `topic`.
- CVE chips add a `cve` facet backed by a new `cve` URL param (comma list) instead of rewriting `q`.

## UI

1. **Active row** (`monitor.tsx` ~2691–2791): replace the hand-written chip list with `facetsFromFilters(...)` rendered by one `FacetChip` component (`components/monitor/facet-chip.tsx`): kind icon, label, × to remove, negated facets with a strike-through style and the word "not". Hover shows the typed token. Group order: text, topics, places, people/orgs, vendors/CVEs, sources/types, toggles, rules.
2. **Clear** removes every facet in the Active row. It keeps desk, time range, and map camera. The button label shows the count: **Clear 4**.
3. **Investigation bar** summary and `activeFilterCount` (`lib/investigation-summary.ts`) come from the same `facetsFromFilters` output.
4. **Search box**: on Enter, run `promoteTypedTokens` so `place:Ireland cyber` becomes a Place chip plus the free text "cyber". Add `person:`, `org:`, `type:`, `category:`, `cve:` to `lib/search-suggest.ts`.
5. **Desk switch**: when moving to a built-in desk with facets active, keep them and show a toast for 6 s: "Kept 3 filters from Brief · Clear". Keyboard: `Esc` on the toast clears them.
6. **More filters** becomes a facet picker: one input at the top, "Filter by anything…", that searches all facet values on the board (topics, families, places, people, orgs, vendors, CVEs, sources, categories, types) and shows the count you would get by adding each one (compute against the current filtered items; the board holds at most `itemLimit` items, so this is cheap). Below the input, the existing grouped chip rows stay for browsing.
7. **Copy as search line** in the Active row's overflow menu: copies `facetsToSearchLine(facets)`, so a view can be pasted into a watch or a live filter.

## Tests

`lib/__tests__/facets.test.ts`: round-trip `parseBoardFilters → facetsFromFilters → removeFacet → boardQueryString` for every kind; old URL with `-topic:sports` in `q`; `promoteTypedTokens` leaves free text; `not=` param negates.

## Acceptance

- Every filter that changes the result set is visible in the Active row and removable there.
- Right-click → Exclude on a topic chip shows "not Sports" in the Active row, and the search box stays empty.
- Old bookmarked URLs (including `qb=` and typed prefixes) produce the same results as before.
- `csmon.md` filter paragraph rewritten around the Active row, Exclude, and the facet picker.
