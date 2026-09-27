# csmon

Current Situation Monitor. Harvest public sources, collapse them into desks, and read in place. The **Home** dashboard is the start: bad weather, earthquakes, war, and civil unrest, plus a map of where coverage relates. Cyber desks rank CISA Known Exploited Vulnerabilities and mine vendor / CVE / ransomware signals so a software owner can see **what to patch** and **why it is urgent**.

Navigation is desks, not a firehose. Filters live in the URL so a view can be bookmarked (`?desk=patch&risk=p0&stack=linux&ransomware=1&layer=12&person=Jane`). Custom filters and **user desks** can also be named and saved in the browser.

Maps are their own panes, never a background under copy. Every map has zoom controls and a pop-out. Country fills are Natural Earth 110m with atlas-style tints; Flights uses Esri World Street Map (political countries and cities) plus heading-aware top-down plane icons instead of dots.

Click a **source** (Home top sources, a card chip, or Sources) to drill into that layer: a source dossier lists its items even if other chips would have hidden them. Source chips are tag-sized like topics: short names, thin padding, wrapping inside the card instead of overflowing a Scan column. RSS feed titles are not treated as authors. CISA and similar feeds no longer go blank because a leftover topic filter was still on.

Click a **map place** (a city/country dot, or a country fill) to open a place dossier: stories, topics, and sources that mention that location. **Ireland**, **UK**, and **US** stay pinned in the chip row even when the catalog is quiet. Ireland matches copy in the title and summary (`Irish`, `Dublin`, `Cork`, `Galway`, `Limerick`, `Belfast`, `Éire`), not only stored location tags. London and UK share a family so the London-area pin still shows British coverage even when older items were tagged only as UK. Shipping chokepoints (Hormuz, Malacca, Suez, Panama, Bab el-Mandeb, Gibraltar, Bosporus) are tagged the same way when they appear in copy.

## How to consume

Default is **Home**.

| Desk | Use when |
| --- | --- |
| Home | Situation dashboard. Click **tech**, a top source, a map place, or a person to filter or drill in. |
| Brief | Clustered stories, 2+ sources first, topic/place/vendor chips. Lowest cognitive load. |
| Scan | Every item, dense cards. Raw desk. Click a source name to isolate that layer. |
| Pulse | **What's rising.** Topics, places, vendors, and people vs the previous half of the time range (sparklines, ▲/▼/new). Click a row to filter. |
| Weather | Storms, floods, heat, official warnings, and live Met Éireann / Met Office / NWS / Open-Meteo events. |
| People | Authors and named voices. Click a person to filter the graph to them. |
| Documents | Reports, PDFs, and advisory-shaped items. |
| Reports | Briefings you compile from Read in place. Full page extract, edit, archive, delete, print to PDF. |
| Flights | Live public ADS-B (OpenSky) within **100 km of home** (default Dublin). Pick home in Options or on the Flights desk. |
| Advisories | Cyber-classified items plus security RSS (CISA, Krebs, BleepingComputer, NCSC). |
| Patch | CISA KEV. Exploited CVEs, due dates, ransomware flag, filter to your stack. |
| Sources | Layers as objects: origin, item count, latest headline. Click a layer to scan it. |
| *Your desks* | **New desk** or **Tune** pins or edits filters on the rail (`c-…` in the URL). The rail shows the **desk name** you typed (one line), not the query sentence. **edit** on a custom desk retunes place, RSS, topic, query, and which board it opens. |

Click a story to **read in place**. When copy or links name a **CVE** (including `nvd.nist.gov/vuln/detail/…`), the reader loads the official **NVD JSON API** (not HTML scraping) and shows CVSS, whether a **patch/fix** is listed, fixed versions, **mitigation** and **release notes** links (from NVD reference tags), vendor advisories, and CISA required action when present. `GET /api/nvd?cves=…`.

The pane is a dossier, not a shrink of the card: every contributing source’s full title and summary, a map of related places, then page extract, deep dive, similar articles, related board stories, documents, people, and KEV hits. On a wide screen, drag the left edge of the pane (or double-click it) to widen the reader; the width stays in `csmon.reader-width`. Topics, places, vendors, people, CVEs, and source names are all filters — they stay on the current desk. **View page** opens the original article in a new tab (news sites block embeds). Related stories and page links open forward; back / Esc walks the trail.

**Report** on the reader sends the story into a briefing, including the same full page extract you see in Read in place (paragraphs, CVEs, vendor/advisory links), not only the RSS title and blurb. The first time you are prompted for a **report title**; after that you can keep adding stories to the same open report. The **Reports** desk lists open and archived briefings. Each report has a bright title, a hard separator between stories, edit title / reorder / remove, archive or delete, and **Print to PDF** (the browser print dialog). Reports live in `csmon.reports`. Older briefings that only stored the RSS summary pull the full copy when you open them.

Hover a source, filter chip, or outbound link for a tooltip (destination URL or what the filter will do). Desk labels already show their hint, so the rail does not duplicate it. Tooltips appear after a short hover and hide as soon as the pointer leaves.

Filter with topic chips (including **AI**, **Sports**, **Reddit**), pinned **place** chips (**Ireland**, **UK**, **US**), other country/city chips, vendor chips, **CVE** chips mined from copy, ransomware, a **layer**, origin (**intel**, **reddit**, **explore**), **RSS**, **rising** (topics/places/vendors/people that accelerated vs the previous half-window), search, time range, **2+ sources**, and the **Query** builder (`equals` / `not equal` / `contains`, combined left-to-right with **AND** / **OR**). A place like Ireland also matches words in the article text. Search also matches mined CVE IDs. Query lives in the URL as `qb` (for example `?qb=title.contains.SharePoint|and.vendor.eq.Microsoft`). **Tune** in the header edits those fields as a form, including the same query rows. **Filters** saves the current URL view under a name.

**Sources** lists every enabled layer. Click **RSS** to keep only RSS feeds, then click **Ireland** (or Tune a place) to hide layers with no matching copy. The same chips work on Brief and Scan.

**Speed.** Brief and Scan paint the first 80 cards, then **Show more**. Clustering runs once per time range (token index, not every-pair), and the reader / flights / reports panes load only when you open them. SQLite uses WAL and writes items in a transaction.

**Pulse / trends.** Compare this half of the time range to the half before it (`24h` is last 12h vs the 12h before; `all` is last day vs the day before). A row is **rising** if volume jumped ≥25% and at least +2 items, **new** if it was absent and now has 2+, **falling** if it dropped ≥25%. Sparklines show the shape. Home **Rising now** uses the same scores. The **rising** chip keeps only items that carry a rising or new topic, place, vendor, or person. Click a trend row to filter.

Cards have **Hide** (drop from the board) and **Read** (keep, mark as seen). **Undo** in the header walks the last hide/read. Triage lives in `csmon.triage` / `csmon.triage-undo`.

**Follow next** on the right is auto-explore: hosts that keep showing up in coverage, one click to add as a layer. Collapse the rail; it stays collapsed in `csmon.follow-open`.

## Home / hazards

Home is the current-situation board. Lanes stay filled even on older items by matching copy, not only stored topic tags. A topic, source, person, or place filter replaces the lanes with the same story cards as Brief (tags, summary, source chips, Hide / Read), packed on the masonry board.

| Lane | What it catches |
| --- | --- |
| Bad weather | Storms, floods, heat, wildfire, official warnings; live events from Open-Meteo (home), Met Éireann, Met Office UK, and NWS |
| Earthquakes | Quakes, aftershocks, tsunami watches; USGS M4.5+ pins on the map |
| War | Combat, invasion, airstrikes, front lines |
| Civil unrest | Protests, riots, coups, martial law |

**Load hazards** pulls USGS, NWS alerts, NHC Atlantic, Met Éireann, Met Office UK, GDACS, and Crisis Group. World RSS still covers the wire desks.

**Home location** (Options, default Dublin) is the ADS-B origin: OpenSky is queried with a bounding box, then tracks farther than 100 km are dropped. That is why Dublin no longer shows a thin global altitude sample. A 100 km ring is drawn on the flight map. Pick World in Options to sample globally again.

## How the graph is linked

Sources are not a dump of unused handles. A source is a layer you chose (or auto-explored) with an origin (`self` / `follow` / `intel` / …). It only earns a place in a story when it actually published an item.

```
Source (layer, origin, freshness)
  └─ Item (title, summary, url, topics, places, language)
       mined → CVE, vendor, ransomware
  Story = items clustered by URL, shared CVE, or title overlap
  Story ─related─ Story (shared CVE / vendor / similar copy / same place+topic)
  Story ─similar─ Story (title overlap that did not meet the related bar)
  Story ─KEV─ catalog row when a CVE is on both
  Story ─map─ geocoded places + USGS quake points + public ADS-B
  Place (city/country) ─mentioned─ Item / Story
  Person (author or named figure) ─wrote/mentioned─ Item
  Document (PDF / report / advisory) ─cited─ Story
```

Read-in-place walks that graph. Isolated sources with zero items are pool only — they do not corroborate anything until they fetch.

Deep dive (in the reader) extracts language, places, dates, quotes, and short briefing bullets from the dossier copy.

## Language

Each article gets a detected language (HTML `lang`, script, or function-word scoring). Options stores a **home language**. From the reader, translate the dossier via the public MyMemory API (cached 7 days, 450-character chunks). Auto-translate can run when the article language differs from home.

## Patch / risk (software owners)

CISA KEV is the exploited-in-the-wild catalog. That is the patch list; CVSS-only queues are mostly noise.

| Risk | Meaning |
| --- | --- |
| Patch now (P0) | Added to KEV in 21 days, due in the next 14 days, or ransomware use listed in 45 days |
| This window (P1) | Ransomware use, or added in 90 days |
| KEV backlog (P2) | Older exploited entries — still patch if you run the product |

Type your stack (`microsoft, openssl, chrome, apache`) to hide vulns that do not match vendor/product. Vendor chips and the ransomware toggle further slice both KEV and advisory copy.

NVD link opens in the reader pane. **KEV** button refreshes the catalog (cached 1h). **RSS** adds a public feed or discovers one from a site. **Options** stores default desk, range, stack, compact layout, home language, home location, **light/dark palette**, auto-translate, and auto-load of security RSS / hazards / KEV. A **Dark / Light** toggle in the header switches the palette immediately.

**Load world RSS** includes DW, France 24, and Sky News. Relief adds GDACS and OCHA. **Load security RSS** includes CISA, CISA ICS, Krebs, BleepingComputer, The Record, NCSC UK, Schneier, Bellingcat, CFR, CSIS, Brookings, Defense One, War on the Rocks, Breaking Defense, The War Zone, The Diplomat, Al-Monitor, DoD news, The Hacker News, Dark Reading, MSRC, CERT-EU. **Load tech RSS** includes Hacker News, Ars Technica, The Verge, MIT Tech Review, arXiv cs.AI, OpenAI news. **Load markets RSS** includes CNBC, MarketWatch, BBC Business, White House, Federal Reserve, SEC. **Load sports RSS** includes BBC Sport, BBC Football, Guardian Sport, ESPN, NYT Sports, and Sky Sports. **Load hazards** includes USGS (significant + M4.5+), NWS CAP alerts, NHC Atlantic, Met Éireann, Met Office UK, GDACS, Crisis Group.

**Subreddits** are their own category (header, empty board, and Sources), not another World/Tech pack. The manager stores names in `csmon.subreddits` (default `worldnews`, `news`, `europe`) and loads them as **one** combined public RSS: `https://www.reddit.com/r/{a}+{b}/hot/.rss?limit=100`. Stable source key `rss:reddit:combined`. Origin reason `reddit`; items are tagged topic `reddit`. Cap 20 subs. Wait a minute between loads.

This is not an asset inventory. It tells you what is being exploited and how soon CISA expects a fix; you still map that to the software you actually run.

Public APIs and RSS only. No recon scanners or unauthorized probing. Maps use Natural Earth country polygons, Esri World Street Map (light) or Dark Gray Canvas (dark) on Flights, geocoded places, USGS GeoJSON, weather warning feeds, and OpenSky ADS-B (cached ~20s, 100 km around home). Aircraft drill-in uses HexDb metadata plus public globe links. This is not Osiris RECON and not a targeting tool.

**Reddit.** Unauthenticated `.json` is shut down (403). Public RSS (`/r/{sub}/.rss`) still works at about **one request per minute per IP**. The Subreddits manager combines the list into a single `/r/a+b/hot/.rss?limit=100` request. Paste a subreddit URL or `.rss` link in RSS still works for one-off layers. Account `user=`/`feed=` tokens are credentials — not used. Official API needs OAuth.

**X / Twitter.** No public RSS. No free API for new apps (pay-per-use credits). Nitter and other scrape proxies are out of scope. Bluesky remains the public social layer.

Public feed lists were expanded from [situation-monitor](https://github.com/hipcityreg/situation-monitor) config (tech, markets, think-tank/defense RSS). We did not take Finnhub/FRED keys, CORS proxies, or military-site overlays.

## What we take from Osiris (osirisai.live)

Osiris is a map/HUD that proxies many public feeds. Useful patterns for csmon: desks/layers, TTL-cached public CVE/KEV/news, keyword risk as a count not a model.

We reuse the **upstream public sources** (CISA, USGS-style RSS, vendor advisories), not Osiris’s own API and not RECON: no DNS/WHOIS/cert sweep, port scan, CCTV, flight maps, or `/api/osint/sweep`.

## Options

Browser-local (`localStorage` `csmon.options`): start desk, time range, stack, compact cards, home language, auto-translate, **home location**, **palette** (`light` / `dark`, follows the OS until you toggle), auto-load security RSS, auto-load hazards, auto-load KEV, **board item limit** (how many recent items SQLite loads onto the board; default 500), optional **update manifest URL**. Shared links still override via the query string.

**Options** uses tabs (Board / Data / Help). **Open manual** is one pop-out at `/help` (user guide, **Source & filter code map**, **Lexicon**, Docker/update checklists). `/help/maintainer` redirects into that manual.

**Source library** (Options → Open source library, or `/sources/workbench`): every layer with last fetch, item counts, latest headline, stale/silent badges, and tips. **Add RSS layer**, **Edit** (inline row), **Save layer** / **Save & refresh layer**, **Delete layer**. **Apply** saves all rows marked ● (unsaved). Per-layer **retention (days)** plus Options **default item retention**; **Purge by age** or **Run retention policy** trim SQLite items (age uses published or fetched time). **Export JSON** / **Import JSON** — move custom RSS layers between installs (same format as GitHub contribution export, local Save drafts, or a JSON array of `{ name, url, feedUrl }`; duplicate feed URLs are skipped). API: `GET/POST/PATCH/DELETE /api/source-catalog` (`POST` body `{ import: [...] }`).

Saved custom filters live in `csmon.saved-filters` (name + full `BoardFilters` snapshot). User desks live in `csmon.user-desks` (label, `view` desk, filters including `platform`). Compiled briefings live in `csmon.reports` (title, open/archived, story snapshots with full page extract, CVEs, links, and places). Subreddit list lives in `csmon.subreddits`. Applying filters writes the URL the same way chips do (`?place=Ireland&platform=rss&qb=title.contains.Ireland`). Hide/read triage is `csmon.triage`; Follow next collapse is `csmon.follow-open`. Reader width is `csmon.reader-width`.

## Caching

Outbound fetches go through SQLite `fetch_cache` so refresh does not hammer the same RSS/KEV/HTML/translation.

| kind | TTL |
| --- | --- |
| rss | 15 minutes |
| json | 30 minutes |
| kev | 1 hour |
| html | 6 hours |
| translate | 7 days |
| live | 20 seconds (ADS-B) |
| nvd (CVE JSON) | 30 minutes (same store as `json`; key `nvd:CVE-…`) |

Expired rows are deleted on read. The Sources desk shows live entry count and bytes.

## Flow

1. Open Home. Load world/hazard/security RSS, manage subreddits, scrape a Bluesky/RSS desk, or load KEV.
2. Pick a desk. Filter topics, **Ireland** (or another place), RSS-only, vendors, stack, or a layer. **Tune** to edit the same fields, then save as a custom desk if you will reuse it.
3. Open a story. Compare desks in the dossier, translate if needed, jump similar coverage, walk back.

## Stack

- pnpm 12.5.1 (`packageManager` in `package.json`)
- Next.js 16 App Router (standalone output for Docker)
- SQLite via Node `node:sqlite` (`$CSMON_DATA_DIR/csmon.sqlite`, default `data/csmon.sqlite`)
- Bluesky public AppView
- RSS/Atom, HTML article extract (`cheerio`)
- CISA KEV JSON catalog
- USGS earthquake GeoJSON
- NWS, Met Éireann, Met Office UK warnings + Open-Meteo local conditions
- Natural Earth 110m country polygons (`public/geo/countries.geojson`) on Leaflet maps (pan / zoom on Flights)
- OpenSky Network ADS-B (100 km around home, or a world grid sample) + HexDb aircraft metadata
- MyMemory translation (public, no key)
- CycloneDX / SPDX SBOMs (`pnpm generate-sbom` → `sbom/`)

## Run

Local: `pnpm install && pnpm dev` (or `pnpm build && pnpm start`). Docker: `ubuntu:24.04` is the `ubuntu` service in `docker-compose.yml`; deploy with `bash scripts/build-docker.sh`. See `DOCKER.md`. Compose publishes `127.0.0.1:3000` only.

## Security

Outbound fetches refuse private/loopback/link-local addresses, odd ports, and credentialed URLs; redirects are re-checked. Optional `CSMON_TOKEN` locks `/api/*` (health stays open). Security headers and a tight CSP ship from `next.config.ts`. Details: `SECURITY.md`.

## Updates

Options shows **version**, **git commit**, and **build date** (`GET /api/version`). **Application updates** calls `GET /api/update`: prefer **`CSMON_UPDATE_MANIFEST_URL`** (static JSON like `public/csmon-update.example.json` on your HTTPS site) or fall back to **`CSMON_UPDATE_REPO`** GitHub releases. Operators can save an allowed manifest URL in Options when `CSMON_UPDATE_MANIFEST_ALLOW_SUFFIX` matches. Apply on the host only: `bash scripts/update.sh` or `bash scripts/update.sh docker` (or set `CSMON_UPDATE_CHECK_URL=https://csmon.lof.ie` for `scripts/update.sh check`). The API never writes to the tree.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `CSMON_DATA_DIR` | `./data` | SQLite directory |
| `CSMON_TOKEN` | unset | Shared secret for API + session cookie |
| `CSMON_SECURE_COOKIE` | unset | `1` adds `Secure` on the session cookie |
| `CSMON_UPDATE_REPO` | `womail/csmon` | GitHub repo when no manifest URL |
| `CSMON_UPDATE_MANIFEST_URL` | unset | HTTPS JSON manifest for private installs |
| `CSMON_UPDATE_MANIFEST_ALLOW_SUFFIX` | unset | Domain suffix for Options manifest override |
| `CSMON_ITEM_LIMIT` | `500` | Default SQL item cap when client omits `?itemLimit=` |

Copy `.env.example` to `.env.local`. No new database tables for this milestone.

## Schema

### seed_users

| column | type | notes |
| --- | --- | --- |
| id | INTEGER PK | |
| handle | TEXT NOT NULL | |
| platform | TEXT NOT NULL | `bluesky` \| `rss` \| `web` |
| did | TEXT | |
| display_name | TEXT | |
| avatar_url | TEXT | |
| description | TEXT | |
| profile_url | TEXT NOT NULL | |
| last_scraped_at | INTEGER | unix ms |
| created_at | INTEGER NOT NULL | unix ms |

### sources

| column | type | notes |
| --- | --- | --- |
| id | INTEGER PK | |
| key | TEXT NOT NULL UNIQUE | |
| name | TEXT NOT NULL | |
| handle | TEXT | |
| url | TEXT NOT NULL | |
| feed_url | TEXT | |
| platform | TEXT NOT NULL | `bluesky` \| `rss` \| `web` |
| kind | TEXT NOT NULL | `account` \| `feed` \| `site` |
| description | TEXT | |
| avatar_url | TEXT | |
| color | TEXT NOT NULL | |
| enabled | INTEGER NOT NULL | 0/1 |
| last_fetched_at | INTEGER | |
| retention_days | INTEGER | Per-layer max item age; NULL uses Options default |
| created_at | INTEGER NOT NULL | |

### source_origins

| column | type | notes |
| --- | --- | --- |
| id | INTEGER PK | |
| source_id | INTEGER NOT NULL | FK sources |
| seed_user_id | INTEGER NOT NULL | FK seed_users |
| reason | TEXT NOT NULL | `self` \| `follow` \| `mention` \| `link` \| `intel` \| `explore` \| `reddit` |
| weight | INTEGER NOT NULL | |
| UNIQUE(source_id, seed_user_id, reason) | | |

### items

| column | type | notes |
| --- | --- | --- |
| id | INTEGER PK | |
| source_id | INTEGER NOT NULL | FK sources |
| external_id | TEXT NOT NULL | |
| title | TEXT NOT NULL | |
| summary | TEXT | |
| url | TEXT NOT NULL | |
| author | TEXT | |
| published_at | INTEGER | unix ms |
| tags | TEXT NOT NULL | JSON |
| topics | TEXT NOT NULL | JSON, `002` — includes `weather`, `quake`, `war`, `unrest`, `sports`, `reddit` |
| locations | TEXT NOT NULL | JSON, `002` |
| fetched_at | INTEGER NOT NULL | |
| UNIQUE(source_id, external_id) | | |

### kev

CISA Known Exploited Vulnerabilities snapshot (`003_kev`).

| column | type | notes |
| --- | --- | --- |
| cve_id | TEXT PK | |
| vendor | TEXT NOT NULL | |
| product | TEXT NOT NULL | |
| name | TEXT NOT NULL | |
| description | TEXT | |
| date_added | INTEGER | unix ms |
| due_date | INTEGER | unix ms, CISA BOD 22-01 date |
| ransomware | INTEGER | 0/1 known campaign use |
| required_action | TEXT | |
| notes | TEXT | |
| fetched_at | INTEGER NOT NULL | |

### fetch_cache

TTL body cache for outbound RSS, JSON, KEV, HTML, and translations (`004_fetch_cache`).

| column | type | notes |
| --- | --- | --- |
| cache_key | TEXT PK | e.g. `rss:https://…`, `kev:catalog`, `translate:en:es:…` |
| kind | TEXT NOT NULL | `rss` \| `json` \| `kev` \| `html` \| `translate` |
| body | TEXT NOT NULL | raw response |
| fetched_at | INTEGER NOT NULL | unix ms |
| expires_at | INTEGER NOT NULL | unix ms |

No new tables for this milestone. Reports stay in `localStorage` (`csmon.reports`) with the full page extract (`body`, `cves`, `links`). Saved filters and language options also stay in `localStorage`. USGS points are fetched live (JSON cache 30m) and not persisted as rows. `CSMON_DATA_DIR` only moves the SQLite file.

## Migrations

- `001_init` — users, sources, origins, items
- `002_topics_locations` — `items.topics`, `items.locations` (skipped if columns already exist)
- `003_kev` — `kev` catalog table
- `004_fetch_cache` — `fetch_cache` TTL table
