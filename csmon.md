# csmon

Current Situation Monitor. Harvest public sources, collapse them into desks, and read in place. The **Home** dashboard is the start: bad weather, earthquakes, war, and civil unrest, plus a map of where coverage relates. Cyber desks rank CISA Known Exploited Vulnerabilities and mine vendor / CVE / ransomware signals so a software owner can see **what to patch** and **why it is urgent**.

Navigation is desks, not a firehose. Filters live in the URL so a view can be bookmarked (`?desk=patch&risk=p0&stack=linux&ransomware=1&layer=12&person=Jane`). The left **desk rail** is grouped: **Situation** (Home, Brief, Pulse, Weather), **Cyber** (Advisories, Patch), **Tools** (Scan, People, Documents, Reports, Flights, Feeds, Sources), then **Live filters** for named searches you keep (`csmon.user-desks`). **New filter** asks for a name and a search line (the same line as the board search). Saving it applies the filter and leaves it on the rail. The Advisories count is the number of story cards on that desk for the current time range, not every advisory-shaped row in the loaded corpus. The **investigation bar** under the header shows desk, time range, active filter count, unread backlog, open report, **Copy link**, **Clear**, and **Unread only**. Primary filter chips stay visible; **More filters** opens origin, platform, topics, places, vendors, CVEs, and people. Custom filters and **user desks** can also be named and saved in the browser.

Maps are their own panes, never a background under copy. **Home**, **reader**, **stats**, and **Flights** use **Leaflet + OpenStreetMap** inline (lazy-loaded on the Home board until visible). Toolbar zoom/fit/world plus **expand** opens a full-screen pop-out of the same map. Map height on situation maps is resizable (`localStorage`).

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
| People | Authors and named voices. Click a person to filter. Right-click a person to filter, copy the name, or save it as a live filter. Each person lists **sources** (filled chip = subscribed layer, outline = pool only). Click a source for a **preview** pane; right-click to subscribe/unsubscribe or preview. |
| Documents | Reports, PDFs, and advisory-shaped items. |
| Reports | Briefings you compile from Read in place. Full page extract, edit, archive, delete, print to PDF. |
| Flights | Live public ADS-B (OpenSky) within **100 km of home** (default Dublin). Pick home in Options or on the Flights desk. |
| Advisories | Cyber-classified items plus security RSS (CISA, Krebs, BleepingComputer, NCSC). The rail count matches the story cards in the current time range. |
| Patch | CISA KEV. Exploited CVEs, due dates, ransomware flag, filter to your stack. Each card carries a FIRST **EPSS** tag; **Rank → EPSS** orders the backlog by exploitation probability. |
| Feeds | Subscribed RSS, nested by category, then title, then the item. The pane is `components/rss` and only receives feed and article lists, so it can move to its own app later. Full-page extract stays on Read. |
| Sources | Layers as objects: origin, item count, latest headline. Click a layer to scan it. **Table** switches to a sortable table with last fetch, status (ok / unchanged / error ×N with the message), new items from the last pull, and the next scheduled pull. |
| *Your desks* | **New desk** or **Tune** pins or edits filters on the rail (`c-…` in the URL). The rail shows the **desk name** you typed (one line), not the query sentence. **edit** on a custom desk retunes place, RSS, topic, query, and which board it opens. Open the desk and the row **Within {name}** nests narrower filters under it (same row on the left rail and above the board). Nothing selected shows the whole desk. On a sports desk the chips offered are the leagues already in the items (NFL, Soccer, and so on). Click **NFL**, then **Soccer**, and both stay (any match). Click a chip again, or **Show all**, to clear it. Type a name such as **Chelsea** and **Add** to keep that filter on the desk. Hover the desk or a chip for how the nesting works. Card tags do the same toggle, and the active chip shows an outline so you can turn it off. |

Click a story to **read in place**. When copy or links name a **CVE** (including `nvd.nist.gov/vuln/detail/…`), the reader loads the official **NVD JSON API** (not HTML scraping) and shows CVSS, whether a **patch/fix** is listed, fixed versions, **mitigation** and **release notes** links (from NVD reference tags), vendor advisories, and CISA required action when present. `GET /api/nvd?cves=…`.

The pane is a dossier, not a shrink of the card: a **context strip** shows desk, range, and **clickable filter chips** (search, place, topic, layer, etc.); clicking a chip closes the reader and keeps you on the same investigation. On large screens you can have **board · reader · place/source dossier** at once — the place or source pane stays open beside the reader instead of replacing it. Then every contributing source’s full title and summary, a map of related places, an **At a glance** strip (read time, places, up to three lead sentences, KEV when relevant), page extract (Mozilla **Readability** when it beats cheerio selectors, else legacy cheerio), deep dive, similar articles, related board stories, documents, people, and KEV hits. On a wide screen, drag the left edge of the pane (or double-click it) to widen the reader; the width stays in `csmon.reader-width`. Topics, places, vendors, people, CVEs, and source names are all filters — they stay on the current desk. **View page** opens the original article in a new tab (news sites block embeds). Related stories and page links open forward; back / Esc walks the trail.

**Report** on the reader sends the story into a briefing, including the same full page extract you see in Read in place (paragraphs, CVEs, vendor/advisory links), not only the RSS title and blurb. The first time you are prompted for a **report title**; after that you can keep adding stories to the same open report. The **Reports** desk lists open and archived briefings. Each report has a bright title, a hard separator between stories, edit title / reorder / remove, archive or delete, and **Print to PDF** (the browser print dialog). Per story, set **confidence** (Verified / Likely / Needs work / Noise); it appears in the document and in **Print to PDF**. Toggle **Timeline** on a report for a chronological synthesis (dates, places, extract age). Reports live in SQLite (`reports`, `report_stories`) and cache in `csmon.reports` for the first load. Older briefings that only stored the RSS summary pull the full copy when you open them. Items cited in a report (or a watch hit) are skipped by retention purge.

**Pulse → Brief.** On **Pulse**, each trend row has **Brief · N** — apply that topic/place/vendor/person filter and jump to **Brief** with the matching item count. **Saved → Filters → Hypotheses** (up to three lines on a named filter). When the board matches that saved filter, the reader shows the hypotheses and lets you tag the open story **Supports / Neutral / Contradicts** (stored in the browser). A dismissible **Getting started** checklist (load feeds, home location, save briefing) appears until you finish or dismiss it.

**Evidence store.** Read in place writes the page extract to `extracts` and indexes title / summary / body in FTS5 (`items_fts`). Search and Pulse then hit the same corpus, including older extract matches that were off the 500-item board. Ingest also mines people, orgs, places, vendors, CVEs, and threat IOCs into `entities` / `item_entities`.

**Typed search.** The board search line accepts prefixes: `source:cisa cve:2024- ioc:sha256 place:Ireland -topic:sports`. Bare words still do substring / FTS. `OR` joins the next term. Tune / Query builder stays as extra `qb=` rules. While typing, a suggestion list (`lib/search-suggest.ts`) offers field prefixes and then values from enabled layers, places, topics, vendors, and authors on the board; arrows move, Tab/Enter accepts, a leading `-` is kept for negation.

**Menus.** Every card has **Read**, then **Link** / **Hide** (revealed on hover on pointer devices), then **⋯**. The ⋯ button, right-click, the ContextMenu key, or **Shift+F10** on the focused card open one shared menu (`components/monitor/context-menu.tsx`): Read in place / Open original / Add to report / Watch this story / Find other coverage; Filter (only this source, topic, place); Triage (mark read, hide, mute layer); Copy (link to card, Markdown citation, title + URL); Organise (display only, display collection, save to My desk, reclassify). Right-click a topic, place, vendor, or source chip for Only / Exclude / Watch; source chips also offer Refresh layer, Copy feed URL, and Mute.

**Reader selection.** Select 3–1200 characters in Read in place for a popover: **Search board** (quoted phrase), **Watch phrase**, **Quote to report** (adds the text to the story's highlights in the open report, or starts one), **Copy**. Highlights render as a "Highlighted" quote block in the report and in Print to PDF.

**Syndication.** Corroboration counts **independent origins**, not layers (`lib/syndication.ts`). Within a story, layers are folded into one origin when they carry the same canonical URL (scheme, `www.`/`m.`/`amp.`, AMP paths, `utm_*`/`fbclid`/`gclid` and similar stripped), the same wire byline (Reuters, AP, AFP, PA, Bloomberg, dpa, ANSA, EFE), or near-identical title + summary text (5-word shingles, ≥50% overlap). Cards show **N sources** for origins plus a dashed **+N syndicated** badge whose tooltip names the folded layers. Brief sorting, the **2+ sources** filter, Home lanes, and the reader header all use the origin count.

**Help.** `/help` is an illustrated user guide: sidebar navigation, search, screenshots of Home, Brief, Pulse, Sources, Patch, and Read in place, plus prev/next between topics. Open it from the toolbar **Help** button, **Options → User manual**, the getting-started checklist, or the command palette (**User guide**). Maintainer sections stay linked from the help header.

**Keyboard.** `/` focuses search. `Ctrl/⌘ K` opens the command palette (desks, places, sources, people, saved filters, watches, clear filters, unread-only). `j` / `k` move the focused card, `Enter` opens it, ContextMenu key or `Shift+F10` opens its menu, `h` hides, `u` undoes, `r` sends the focused story to the open report (or starts one) and shows a short **report toast**. `1`–`9` jump Home through Flights. `?` is the cheatsheet. Esc closes the palette, then the reader.

**Watch.** Save watches from **Saved → Watches** or the palette. New matches are logged, stay off the purge list, and can POST to an optional public ntfy URL. Click a watch (palette, Saved dialog, or the orange hits chip) to reopen its query and desk. The investigation bar **Report** chip opens the active briefing on the Reports desk.

Hover a source, filter chip, or outbound link for a tooltip (destination URL or what the filter will do). Desk labels already show their hint, so the rail does not duplicate it. Tooltips appear after a short hover and hide as soon as the pointer leaves.

Filter with topic chips (including **AI**, **Sports**, **Reddit**), pinned **place** chips (**Ireland**, **UK**, **US**), other country/city chips, vendor chips, **CVE** chips mined from copy, ransomware, a **layer**, origin (**intel**, **reddit**, **explore**), **RSS**, **rising** (topics/places/vendors/people that accelerated vs the previous half-window), search, time range, **2+ sources**, and the **Query** builder (`equals` / `not equal` / `contains`, combined left-to-right with **AND** / **OR**). A place like Ireland also matches words in the article text and stored extracts. Search also matches mined CVE IDs and extract body. Query lives in the URL as `qb` (for example `?qb=title.contains.SharePoint|and.vendor.eq.Microsoft`) and as a typed line in `q` (`source:cisa cve:2024-`). **Tune** edits those fields as a form and shows a **live match count** (items, and approximate **story** count on clustered desks) while you edit. **Set up monitoring** (empty board or **Sources**) runs a **Quick** path (world + security + hazards + KEV, optional politics + **Politics** desk on the rail) or **Full customize** (pick packs, home, watch). Loading politics can pin a **Politics** user desk (Brief · topic politics · intel origin). Story cards on Brief / Pulse show **corroboration** badges: source count, **Rising** when a topic/place/vendor in the story is hot, and **KEV** when copy hits the loaded catalog. **Sources** includes a **corpus analysis** card (SQLite totals, cache, GDELT/ACLED layers) with a link to `/stats`. **Saved** (header) is one dialog with tabs: **Filters** (named URL snapshots), **Briefing** (default board + enabled layers), and **Watches** (alert queries + ntfy).

**Sources** lists every enabled layer. Click **RSS** to keep only RSS feeds, then click **Ireland** (or Tune a place) to hide layers with no matching copy. The same chips work on Brief and Scan.

**Speed.** Brief and Scan paint the first 80 cards, then **Show more**. Clustering runs once per time range (token index, not every-pair), and the reader / flights / reports panes load only when you open them. SQLite uses WAL and writes items in a transaction.

**Pulse / trends.** Compare this half of the time range to the half before it (`24h` is last 12h vs the 12h before; `all` is last day vs the day before). A row is **rising** if volume jumped ≥25% and at least +2 items, **new** if it was absent and now has 2+, **falling** if it dropped ≥25%. Sparklines show the shape. Home **Rising now** uses the same scores. The **rising** chip keeps only items that carry a rising or new topic, place, vendor, or person. Click a trend row to filter.

Cards have **Hide** (drop from the board) and **Read** (keep, mark as seen). **Link** (or right-click **Copy link to card**) copies a URL with `?item=<id>` plus current desk filters; opening it scrolls to the card and opens **Read in place**. **Right-click** also offers **Display only** / **Add to display collection** (pins item IDs in `csmon.display-collection`), **Save to My desk…** (guessed title from place/topic/tags/title; filters include topics, tags, place, and source layer), and **Reclassify** (topic tags persisted in SQLite; the board, open reader, and topic chips update immediately). NVD / patch panels in the reader only run for CVEs mentioned in the item’s RSS title or summary (not unrelated CVEs buried in a page extract). **Brief / Scan cards** show the same feed-mined CVEs with **KEV** and **EPSS** chips when loaded (no need to open Patch desk first). **Shift+click** a topic chip on a card removes that tag (e.g. drop a wrong `conflict` on a weather warning). The board time range uses **article publication date** only (`published_at` from RSS/Atom or page meta)—not when the row was ingested. Items with no publish date are hidden outside **All**. **Read in place** can backfill `published_at` from the live page (JSON-LD, `article:published_time`, `<time datetime>`). Header **Sort** orders by newest, topic, tag, place, or source. **Tune** can set **Topics (any)** and **Tags (any)** on custom desks (`topics=` / `tags=` in the URL). **Briefing** (next to Filters) saves **My briefing** to the browser: desk, topic, place, range, rising, 2+ sources (`cross`), layer focus, and which layers were enabled; **Apply** restores that view and re-enables those layers. **Undo** in the header walks the last hide/read. Triage lives in `csmon.triage` / `csmon.triage-undo`.

**Follow next** on the right is auto-explore: hosts that keep showing up in coverage and are not layers yet. **Add** discovers a feed and turns the host into a layer. **Skip** hides that host (`csmon.follow-skip`). Under that, **Unused sources** are layers already in the catalog with the switch off. **Subscribe** turns the layer on. **Preview** lists its items without turning it on. Right-click still offers the same menu. Search with **Find unused sources**. Collapse the rail; it stays collapsed in `csmon.follow-open`. The rail is hidden on Feeds so the category, title, and article columns can use the width.

## Home / hazards

Home is the current-situation board. Lanes stay filled even on older items by matching copy, not only stored topic tags. A topic, source, person, or place filter replaces the lanes with the same story cards as Brief (tags, summary, source chips, Hide / Read), packed on the masonry board.

| Lane | What it catches |
| --- | --- |
| Bad weather | Storms, floods, heat, wildfire, official warnings; live events from Open-Meteo (home), Met Éireann, Met Office UK, and NWS |
| Earthquakes | Quakes, aftershocks, tsunami watches; USGS M4.5+ pins on the map |
| War | Combat, invasion, airstrikes, front lines |
| Civil unrest | Protests, riots, coups, martial law |

**Load hazards** pulls USGS, NWS alerts, NHC Atlantic, Met Éireann, Met Office UK, GDACS, and Crisis Group. World RSS still covers the wire desks.

Live panels under the lanes (not stored as items):

- **Weather events** (`GET /api/weather?lat&lng&place`). For a European home (nearest capital within 700 km, 16 countries) csmon reads the national **MeteoAlarm** CAP Atom feed (`feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-{country}`, CC BY 4.0), drops expired warnings, and groups them by event + severity ("Gale-force gusts warning · 89 areas", tooltip lists areas and expiry). When MeteoAlarm covers Ireland or the UK, the Met Éireann / Met Office RSS for that country is skipped to avoid duplicates. NWS is only pulled for US homes or homes outside MeteoAlarm. Open-Meteo local conditions stay first.
- **Natural events · NASA EONET** (`GET /api/hazards`): open events from the last 10 days (`eonet.gsfc.nasa.gov/api/v3/events`), skipping sea/lake ice, snow, water colour, and man-made categories. Latest geometry point (polygon → centroid) is pinned on the Home map; magnitude (kts, acres) shows when present.
- **Internet outages · IODA** (same route): country-level outage summary for the last 24 h from Georgia Tech IODA (`api.ioda.inetintel.cc.gatech.edu/v2/outages/summary?entityType=country`), ranked by overall score, with event count and which signals moved (BGP routes, active probing, Google traffic, darknet telescope). Each row links to the IODA country dashboard.

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

**Vulnerability response** (Read in place, CVE stories): **KEV/NVD/CWE catalog plan** via `POST /api/vuln/response` — incident steps, three-part checklist, MITRE CWE mitigations (`GET /api/cwe?cwes=…`), mitigation links, threat IOCs (excluding vendor/CERT reference URLs). Rules and floors in `lib/laya-rules-fallback.ts`, `lib/vuln-response-checklist.ts`, `lib/incident-response-plan.ts`. Snapshots attach to reports as `vulnPlan`.

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

**EPSS.** The Patch desk asks `GET /api/epss?cves=…` for up to 400 visible CVEs; the server batches 100 per call to `https://api.first.org/data/v1/epss` and caches each score as `epss:CVE-…` for 12 h (misses cached as `null`). Tags are tinted hot (≥10%), warm (≥1%), or cool. **Rank → EPSS** sorts by score; **CISA risk** keeps the P0/P1/P2 order. KEV says a CVE is exploited; EPSS orders a long backlog.

**OSV.** For CVE stories, Read in place shows an **Open-source packages** panel under NVD: `GET /api/osv?cves=…` (max 4) loads the CVE from `https://api.osv.dev/v1/vulns/{id}` plus up to two GHSA aliases (CVE records alone usually carry only git ranges), then lists ecosystem, package, fixed versions, and last-affected versions with links to osv.dev. Cached as `osv:CVE-…` for 24 h.

NVD link opens in the reader pane. **KEV** button refreshes the catalog (cached 1h). **RSS** adds a public feed or discovers one from a site. **Options** stores default desk, range, stack, compact layout, home language, home location, **light/dark palette**, auto-translate, and auto-load of security RSS / hazards / KEV. A **Dark / Light** toggle in the header switches the palette immediately.

**Load world RSS** includes DW, France 24, and Sky News. Relief adds GDACS and OCHA. **Load security RSS** includes CISA, CISA ICS, **CSIRTS exploited**, **CCCS Canada**, Krebs, BleepingComputer, The Record, NCSC UK (all advisories), Schneier, Bellingcat, CFR, CSIS, Brookings, Defense One, War on the Rocks, Breaking Defense, The War Zone, The Diplomat, Al-Monitor, DoD news, The Hacker News, Dark Reading, MSRC, CERT-EU. **Load politics RSS** includes Politico, Foreign Affairs, Euronews, BBC Politics, Reuters World. **Load tech RSS** includes Hacker News, Ars Technica, The Verge, MIT Tech Review, arXiv cs.AI, OpenAI news. **Load markets RSS** includes CNBC, MarketWatch, BBC Business, White House, Federal Reserve, SEC. **Load sports RSS** includes BBC Sport, BBC Football, Guardian Sport, ESPN, NYT Sports, and Sky Sports. **Load hazards** includes USGS (significant + M4.5+), NWS CAP alerts, NHC Atlantic, Met Éireann, Met Office UK, GDACS, Crisis Group. **Advisory feed health** — `/stats` lists CISA + CSIRTS + CCCS probe results (15-minute cache, **Probe now**); **Load security RSS** refreshes probes. If CISA RSS fails, enable the CSIRTS layer.

**Subreddits** (until **13 Nov 2026**) are their own category. Names live in `csmon.subreddits` and load as one combined public RSS (`rss:reddit:combined`, origin `reddit`). After that date Reddit ends public RSS — csmon **disables** the layer on 404/410 or calendar sunset, shows a header banner, and offers **Import to GDELT** (keyword queries from saved sub names). Replacements: Bluesky, GDELT, wire RSS. **Reddit OAuth** — After RSS ends, add a Reddit **script/app** id and secret in **Options → Data** (or `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` on the server). **Load Reddit** uses `client_credentials` and `oauth.reddit.com` listings instead of RSS.

**GDELT** (header **Intel → GDELT**) is the [GDELT Project](https://www.gdeltproject.org/) DOC 2.0 article API. **Ingest is paused by default** (`CSMON_ENABLE_GDELT=1` on the server to turn on). When enabled: queries live in `csmon.gdelt`, **Load GDELT** registers layers (`gdelt:{id}`, origin `gdelt`), **one HTTP call every ~6s**, 429 → **90s cooldown**. Probe: `node scripts/test-gdelt.mjs`. Credit GDELT.

**ACLED** (header **Intel → ACLED**) pulls structured conflict/protest events when `ACLED_USERNAME` and `ACLED_PASSWORD` (myACLED) are set. **Ingest is paused by default** (`CSMON_ENABLE_ACLED=1` plus credentials). Profiles save in `csmon.acled` and register as `acled:{id}` layers (origin `acled`). See Options → Data for setup steps.

**Other geopolitical APIs** from the [2026 comparison](https://www.worldmonitor.app/blog/posts/free-geopolitical-data-apis-2026/): USGS and GDACS are in **Load hazards**. UCDP, NASA FIRMS, and Cloudflare Radar still need separate keys.

This is not an asset inventory. It tells you what is being exploited and how soon CISA expects a fix; you still map that to the software you actually run.

Public APIs and RSS only. No recon scanners or unauthorized probing. Maps use Natural Earth country polygons, **OpenStreetMap** tiles, geocoded places, USGS GeoJSON, weather warning feeds, and OpenSky ADS-B (cached ~20s, 100 km around home). Aircraft drill-in uses HexDb metadata plus public globe links. This is not Osiris RECON and not a targeting tool.

**Reddit.** Public RSS ends **13 Nov 2026** ([announcement](https://techcrunch.com/2026/09/30/reddit-is-killing-rss-feeds-ending-public-api-access-because-of-ai-bots/)). Until then, combined `/r/a+b/hot/.rss` works at about **one request per minute per IP**. After sunset, refresh returns a clear message and disables the layer instead of repeated 502s. `.json` without auth remains 403. Paid/OAuth API access is out of scope unless you add your own app credentials later.

**X / Twitter.** No public RSS. No free API for new apps (pay-per-use credits). Nitter and other scrape proxies are out of scope. Bluesky remains the public social layer.

Public feed lists were expanded from [situation-monitor](https://github.com/hipcityreg/situation-monitor) config (tech, markets, think-tank/defense RSS). We did not take Finnhub/FRED keys, CORS proxies, or military-site overlays.

## What we take from Osiris (osirisai.live)

Osiris is a map/HUD that proxies many public feeds. Useful patterns for csmon: desks/layers, TTL-cached public CVE/KEV/news, keyword risk as a count not a model.

We reuse the **upstream public sources** (CISA, USGS-style RSS, vendor advisories), not Osiris’s own API and not RECON: no DNS/WHOIS/cert sweep, port scan, CCTV, flight maps, or `/api/osint/sweep`.

## Options

Browser-local (`localStorage` `csmon.options`): start desk, time range, stack, compact cards, home language, auto-translate, **home location**, **palette** (`light` / `dark`, follows the OS until you toggle), auto-load security RSS, auto-load hazards, auto-load KEV, **board item limit** (how many recent items SQLite loads onto the board; default 500), optional **update manifest URL**. Shared links still override via the query string.

**Options** uses tabs (Board / Data / Help). **Open manual** is one pop-out at `/help` (user guide, **Source & filter code map**, **Lexicon**, Docker/update checklists). `/help/maintainer` redirects into that manual. **Data → Open analysis** opens `/stats`: SQLite size, outbound cache by kind, extract corpus bytes, layer counts by origin, plus **GDELT** and **ACLED** panels (items in DB, cached response size, OAuth token status for ACLED, last fetch, latest headline/event, status badge, **Fetch now**). API: `GET /api/stats`.

**Source library** (Options → Open source library, or `/sources/workbench`): every layer with last fetch, item counts, latest headline, stale/silent badges, and tips. **Add RSS layer**, **Edit** (inline row), **Save layer** / **Save & refresh layer**, **Delete layer**. **Apply** saves all rows marked ● (unsaved). Per-layer **retention (days)** plus Options **default item retention**; **Purge by age** or **Run retention policy** trim SQLite items (age uses published or fetched time; items in a report or watch hit are kept). **Export JSON** / **Import JSON** — move custom RSS layers between installs. **Save instance overrides** writes intel-linked layer edits to `CSMON_DATA_DIR/overrides/feeds.json` on the server; that file is merged over `lib/intel-feeds.ts` at runtime (volume survives rebuilds). API: `GET/POST/PATCH/DELETE /api/source-catalog` (`POST` `{ import: [...] }`, `PATCH` `{ saveFeedOverrides: true }`).

Saved custom filters live in `csmon.saved-filters` (name + full `BoardFilters` snapshot). User desks live in `csmon.user-desks` (label, `view` desk, filters including `platform`, `topics[]`, `tags[]`). Display-only collections live in `csmon.display-collection`. Compiled briefings live in SQLite `reports` (browser cache `csmon.reports`). Watchlists live in SQLite. Subreddit list lives in `csmon.subreddits`. GDELT queries live in `csmon.gdelt`. Applying filters writes the URL the same way chips do (`?place=Ireland&platform=rss&topics=war,unrest&tags=gdelt&qb=title.contains.Ireland`). Hide/read triage is `csmon.triage`; Follow next collapse is `csmon.follow-open`; skipped Follow next hosts are `csmon.follow-skip`. Reader width is `csmon.reader-width`.

## Caching

Outbound fetches go through SQLite `fetch_cache` so refresh does not hammer the same RSS/KEV/HTML/translation.

| kind | TTL |
| --- | --- |
| rss | 15 minutes |
| json | 30 minutes (includes GDELT DOC article lists) |
| kev | 1 hour |
| html | 6 hours |
| translate | 7 days |
| live | 20 seconds (ADS-B) |
| nvd (CVE JSON) | 30 minutes (same store as `json`; key `nvd:CVE-…`) |
| cwe (MITRE weakness JSON) | 7 days (`cwe:502,787…` via `https://cwe-api.mitre.org/api/v1/cwe/weakness/…`) |
| epss | 12 hours (`epss:CVE-…`, stored as `json`) |
| osv | 24 hours (`osv:CVE-…`, stored as `json`) |

**Conditional requests.** `cachedGet` (`lib/http.ts`) stores `ETag` / `Last-Modified` with each 200 and, once a row is stale, sends `If-None-Match` / `If-Modified-Since`. A 304 re-arms the TTL on the cached body without downloading it, and the layer records status `not_modified` (no insert). Stale rows are kept for 3 days (`STALE_KEEP_MS`) so validators survive; manual **Refresh** marks rows stale (`expires_at = MIN(expires_at, now-1)`) instead of deleting them. At most 2 concurrent requests per host.

**Server scheduler.** `instrumentation.ts` starts `lib/scheduler.ts` in the Node runtime (not during build). Every 60 s (first tick after 15 s) it refreshes up to 24 due layers (`sources.next_fetch_at <= now`, or never scheduled and not fetched in 15 min). After each pull the next slot is set by `lib/fetch-schedule.ts`: half the median gap between the layer's last 12 posts, clamped to 10 min–4 h; ACLED 6 h, GDELT 30 min, Reddit 20 min, Bluesky 15 min. Failures back off exponentially (capped at 12 h) and store the error. GDELT layers skipped during the 429 cooldown are deferred past it. When the scheduler is on, the browser polls `GET /api/state` every 2 min instead of POSTing refreshes; `GET /api/scheduler` reports `{enabled, running, lastTickAt, lastRun}`. In `pnpm dev` the scheduler keeps the module copies it started with — restart the dev server after editing fetch code. Disable with `CSMON_SCHEDULER=0`.

Rows past their keep window are purged on read. The Sources desk shows live entry count and bytes. Article extracts are stored in `extracts` (not TTL) and indexed in `items_fts`. `GET /api/state?q=` unions recent items with FTS hits. `GET/POST /api/reports` and `GET/POST /api/watchlists` persist analyst work.

## Flow

1. Open Home. Load world/hazard/security RSS, manage subreddits, tune GDELT queries, scrape a Bluesky/RSS desk, or load KEV.
2. Pick a desk. Filter topics, **Ireland** (or another place), RSS-only, vendors, stack, or a layer. **Tune** to edit the same fields, then save as a custom desk if you will reuse it.
3. Open a story. Compare desks in the dossier, translate if needed, jump similar coverage, walk back.

## Stack

- pnpm 12.5.1 (`packageManager` in `package.json`)
- Next.js 16 App Router (standalone output for Docker)
- SQLite via Node `node:sqlite` (`$CSMON_DATA_DIR/csmon.sqlite`, default `data/csmon.sqlite`)
- Bluesky public AppView
- RSS/Atom, HTML article extract (**Readability** + cheerio fallback, links/meta still from DOM)
- GDELT DOC 2.0 article JSON (`https://api.gdeltproject.org/api/v2/doc/doc`, tuned queries, no key)
- CISA KEV JSON catalog
- USGS earthquake GeoJSON
- NWS, Met Éireann, Met Office UK, and MeteoAlarm (CAP Atom) warnings + Open-Meteo local conditions
- NASA EONET natural events, Georgia Tech IODA internet outages
- FIRST EPSS scores, OSV.dev package advisories
- Natural Earth 110m country polygons (`public/geo/countries.geojson`) on Leaflet maps (pan / zoom on Flights)
- OpenSky Network ADS-B (100 km around home, or a world grid sample) + HexDb aircraft metadata
- MyMemory translation (public, no key)
- CycloneDX / SPDX SBOMs (`pnpm generate-sbom` → `sbom/`)

## Run

Local: `pnpm install && pnpm dev` (or `pnpm build && pnpm start`). Docker: `ubuntu:24.04` is the `ubuntu` service in `docker-compose.yml`; deploy with `bash scripts/build-docker.sh`. **Proxmox (from scratch):** Community Scripts CT — curl `scripts/community-scripts/ct/csmon.sh` on the hypervisor (wizard + install + `update`; see `scripts/community-scripts/README.md` and `DOCKER.md`). **Existing guest:** `sudo scripts/proxmox-starter.sh install` / `update`. LAN `:3000` via `docker-compose.lan.yml` or those scripts.

**VM slots (production / pre-production).** `bash scripts/csmon-deploy.sh` opens an operator menu (or use subcommands: `pull-build`, `start`, `promote`, `rollback`). State lives in `.csmon-deploy/` (gitignored): production uses the repo checkout on port **3000**, pre-production clone on **3010**, both bound to all interfaces by default. **Promote** swaps application code only; live SQLite and `.env.local` stay in `.csmon-deploy/shared/` (see `deploy/manifest.sh`). Pre-production tests against a **snapshot** of production data. Runtime **docker** or **node** is selectable once and stored in state. Retention rules and ports are versioned under `deploy/` for reuse on other hosts.

## Security

Outbound fetches refuse private/loopback/link-local addresses, odd ports, and credentialed URLs; redirects are re-checked. Optional `CSMON_TOKEN` locks `/api/*` (health stays open). Security headers and a tight CSP ship from `next.config.ts`. Check the tree with `pnpm security:audit` and `pnpm security:outbound`, and a running loopback instance with `pnpm security:live`. Agent prompts for development, for what to keep, and for hardening are in `prompts/`. Details: `SECURITY.md`.

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
| `CSMON_SCHEDULER` | on | `0` disables the server-side refresh scheduler (browser auto-refresh takes over) |

Copy `.env.example` to `.env.local`.

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
| last_status | TEXT | `ok` \| `not_modified` \| `error` (`007_fetch_health`) |
| last_error | TEXT | last failure message, cleared on success (`007`) |
| fail_count | INTEGER NOT NULL DEFAULT 0 | consecutive failures, drives backoff (`007`) |
| next_fetch_at | INTEGER | unix ms, next scheduler slot; NULL = not yet scheduled (`007`) |
| last_added | INTEGER | new items created by the last pull (`007`) |

Index `idx_sources_next_fetch ON sources(enabled, next_fetch_at)` (`007`).

### source_origins

| column | type | notes |
| --- | --- | --- |
| id | INTEGER PK | |
| source_id | INTEGER NOT NULL | FK sources |
| seed_user_id | INTEGER NOT NULL | FK seed_users |
| reason | TEXT NOT NULL | `self` \| `follow` \| `mention` \| `link` \| `intel` \| `explore` \| `reddit` \| `gdelt` |
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

Page extract (if read) lives in `extracts`, not as extra columns here. Board state may include a truncated `extractText` plus mined `entities` / `iocs`.

### extracts

Persisted Read-in-place copy (`006_evidence`).

| column | type | notes |
| --- | --- | --- |
| item_id | INTEGER PK | FK items ON DELETE CASCADE |
| url | TEXT NOT NULL | |
| title | TEXT | |
| description | TEXT | |
| body | TEXT NOT NULL | paragraphs joined |
| quotes | TEXT NOT NULL | JSON |
| language | TEXT | |
| cves | TEXT NOT NULL | JSON |
| extracted_at | INTEGER NOT NULL | unix ms |

### items_fts

FTS5 virtual table (`title`, `summary`, `body`). `rowid` = `items.id`. Rebuilt on ingest and when an extract is saved.

### entities

Named things mined on ingest / extract (`006_evidence`).

| column | type | notes |
| --- | --- | --- |
| id | INTEGER PK | |
| kind | TEXT NOT NULL | `person` \| `org` \| `place` \| `vendor` \| `cve` \| `ioc` |
| key | TEXT NOT NULL | normalized |
| label | TEXT NOT NULL | |
| extra | TEXT | reserved JSON |
| first_seen | INTEGER NOT NULL | |
| last_seen | INTEGER NOT NULL | |
| UNIQUE(kind, key) | | |

### item_entities

| column | type | notes |
| --- | --- | --- |
| item_id | INTEGER NOT NULL | FK items |
| entity_id | INTEGER NOT NULL | FK entities |
| PRIMARY KEY(item_id, entity_id) | | |

### watchlists

| column | type | notes |
| --- | --- | --- |
| id | INTEGER PK | |
| name | TEXT NOT NULL | |
| query | TEXT NOT NULL | typed search line |
| notify_url | TEXT | optional public ntfy POST URL |
| desk | TEXT | desk to reopen |
| created_at | INTEGER NOT NULL | |
| last_hit_at | INTEGER | |
| last_ack_at | INTEGER | |

### watch_hits

| column | type | notes |
| --- | --- | --- |
| id | INTEGER PK | |
| watchlist_id | INTEGER NOT NULL | FK watchlists |
| item_id | INTEGER NOT NULL | FK items |
| hit_at | INTEGER NOT NULL | |
| UNIQUE(watchlist_id, item_id) | | |

### reports / report_stories

Compiled briefings (`006_evidence`). Browser `csmon.reports` is a cache; `GET/POST /api/reports` is source of truth.

| reports column | type | notes |
| --- | --- | --- |
| id | TEXT PK | |
| title | TEXT NOT NULL | |
| status | TEXT NOT NULL | `open` \| `archived` |
| created_at | INTEGER NOT NULL | |
| updated_at | INTEGER NOT NULL | |

| report_stories column | type | notes |
| --- | --- | --- |
| id | TEXT PK | `{reportId}:{storyId}` |
| report_id | TEXT NOT NULL | FK reports |
| item_id | INTEGER | first board item, for purge protection |
| position | INTEGER NOT NULL | |
| snapshot | TEXT NOT NULL | JSON ReportStory |
| created_at | INTEGER NOT NULL | |

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
| kind | TEXT NOT NULL | `rss` \| `json` \| `kev` \| `html` \| `translate` \| `live` |
| body | TEXT NOT NULL | raw response |
| fetched_at | INTEGER NOT NULL | unix ms |
| expires_at | INTEGER NOT NULL | unix ms; stale rows kept 3 days for revalidation |
| etag | TEXT | response `ETag`, sent as `If-None-Match` (`007_fetch_health`) |
| last_modified | TEXT | response `Last-Modified`, sent as `If-Modified-Since` (`007`) |

Saved filters, user desks, language options, and triage stay in `localStorage`. USGS points are fetched live (JSON cache 30m) and not persisted as rows. `CSMON_DATA_DIR` only moves the SQLite file.

## Migrations

- `001_init` — users, sources, origins, items
- `002_topics_locations` — `items.topics`, `items.locations` (skipped if columns already exist)
- `003_kev` — `kev` catalog table
- `004_fetch_cache` — `fetch_cache` TTL table
- `005_source_retention` — `sources.retention_days`
- `006_evidence` — extracts, FTS5, entities, watchlists, reports
- `007_fetch_health` — `fetch_cache.etag`, `fetch_cache.last_modified`; `sources.last_status`, `last_error`, `fail_count`, `next_fetch_at`, `last_added`; index `idx_sources_next_fetch`. Columns are added with `ADD COLUMN` only when missing (`ensureFetchHealthColumns` also runs on every start once 007 is recorded)
