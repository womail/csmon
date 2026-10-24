# 06 — Source category and source type

Depends on: 02 (the classifier accepts a `category`/type hint).

## Why

A layer has a platform, a kind, and an origin, but nothing that says **what sort of source it is**. That matters to the user in three ways:

1. **Finding feeds.** The 41 ThreatFilter layers imported by OPML keep their folder ("CERTs & Government Advisories", "Endpoint & EDR Vendors", "Vulnerability Management") only in `sources.description`. The Feeds desk (`lib/rss-library.ts` `rssFeedCategory`) files every one of them under "Added by you".
2. **Trust at a glance.** A CERT bulletin and a blog repost of it are different evidence. The user wants to see "covered by 2 CERTs and 4 outlets", and to filter to official sources.
3. **Correct topics.** A vendor security blog post that says "research" or "defender" is cyber. The classifier needs the source type as a prior (task 02 `TopicHint`).

## Schema — migration `009_source_category`

| table | column | type | notes |
| --- | --- | --- | --- |
| sources | `category` | TEXT | Human folder, e.g. "CERTs & Government Advisories", "World", "Sports". NULL = derive at read time |
| sources | `source_type` | TEXT | One of the `SourceType` values below. NULL = derive at read time |

Document in `csmon.md` → Schema → sources and Migrations.

```ts
// lib/source-types.ts (pure)
export type SourceType =
  | "wire"            // Reuters, AP, AFP
  | "outlet"          // newspapers, broadcasters, news sites
  | "government"      // ministries, agencies, White House, Fed, SEC
  | "cert"            // CISA, NCSC, CERT-EU, CERT-FR, JPCERT, CCCS, CSIRTs
  | "vendor"          // MSRC, Cisco PSIRT, Splunk SVD, vendor security blogs
  | "research"        // threat-intel labs, ZDI, academic, arXiv
  | "think_tank"      // CFR, CSIS, Brookings, Crisis Group
  | "hazard_official" // USGS, NWS, Met Éireann, Met Office, GDACS, NHC, MeteoAlarm
  | "blog"            // personal or independent blogs (Krebs, Schneier)
  | "social"          // Bluesky accounts, Reddit
  | "aggregator";     // GDELT, Google News, combined feeds

export const SOURCE_TYPE_LABEL: Record<SourceType, string>; // "CERT", "Vendor", "Wire", …
export const OFFICIAL_TYPES: ReadonlySet<SourceType>;       // government, cert, hazard_official
export function deriveSourceType(source: Pick<Source, "platform" | "handle" | "feedUrl" | "url" | "name" | "origins">, category?: string | null): SourceType;
export function sourceCategory(source: Source): string; // stored category, else intel pack label, else derived
```

## Steps

1. **Intel catalog.** Add `type: SourceType` to every entry of `INTEL_FEEDS` in `lib/intel-feeds.ts` (go through all of them; there are about 110). `category` for intel layers is the pack label already used by `rssFeedCategory` ("World", "Security", …).
2. **OPML.** `lib/opml.ts`: put the folder path in `category` (`"CERTs & Government Advisories"`; nested folders joined with ` › `). Keep `description` for an actual description attribute when the OPML has one. Map folder names to a type with a small keyword table (`cert|government|advisor` → cert, `vendor` → vendor, `news` → outlet, `research|intel|lab` → research, otherwise blog). Extend `CreateSourceInput` (`lib/source-catalog-shared.ts`) and `createManualSource` with optional `category` and `sourceType`.
3. **Backfill once** in the migration: for `handle = 'manual'` rows whose `description` equals one of the known ThreatFilter folder names (query `SELECT DISTINCT description FROM sources WHERE handle='manual'`), copy it into `category` and derive the type. For everything else leave NULL and derive at read time.
4. **Derivation fallback** in `deriveSourceType`: Bluesky → social; Reddit / `rss:reddit:` → social; GDELT, Google News (`news.google.com`), combined feeds → aggregator; ACLED → research; hosts on `.gov`, `.gov.uk`, `.gov.ie`, `.europa.eu` → government unless the name contains CERT/CSIRT/NCSC → cert; known wires by host (reuters.com, apnews.com, afp.com) → wire; else outlet.
5. **Catalog API and workbench.** `buildSourceCatalog` returns `category` and `sourceType` (resolved). In `components/monitor/source-workbench.tsx` the row editor gets a **Category** text input with a `<datalist>` of existing categories and a **Type** select. Save via the existing PATCH (`SourcePatch` gains both fields; `validatePatch` checks the enum).
6. **Feeds desk.** `rssFeedCategory` returns `sourceCategory(source)`. OPML layers now appear under their folder names.
7. **Sources desk.** Group tiles and table by category (collapsible headers with layer counts). Add a **Type** column to the table and sort by it.
8. **Board filter.** New URL params: `stype` (comma list of types) and `cat` (one category). Parse/serialize in `lib/board-state.ts`; filter in `lib/board-item-filter.ts` via the item's source. Typed search: `type:cert`, `category:"Endpoint & EDR Vendors"` in `parseQueryLine` (`lib/query-builder.ts`) and in `lib/search-suggest.ts`. In **More filters**, add a **Source type** chip row with counts. Task 08 folds these into the facet model.
9. **Cards and stories.** Source chips carry a tiny type mark (one or two letters or a lucide icon: Shield for cert/government, Building for vendor, Radio for wire, FlaskConical for research) with the tooltip "{Type} · {category}". The story corroboration badge tooltip lists origins by type: "3 origins · 1 CERT, 2 outlets". When an official type is among the origins, show an **Official** badge next to the source count. This does not change the origin count.
10. **Classifier hint.** Pass `category` and `sourceType` into `TopicHint` at every call site from task 02. Prior table: cert/vendor/research → +2 cyber and the security damping from task 02; hazard_official → +2 weather or quake by feed; sports category → +2 sports.

## Acceptance

- `/sources/workbench`: ThreatFilter rows show their folder as Category and a sensible Type; editing either persists after reload.
- Feeds desk lists "CERTs & Government Advisories", "Security News", "Endpoint & EDR Vendors", and so on.
- `?stype=cert` shows only items from CERT layers; **Copy link** keeps it.
- `csmon.md`: Sources, Feeds, filters, and schema sections describe category and type.
