# csmon

Current Situation Monitor. Harvest public sources, collapse them into desks, and read in place. Cyber desks rank CISA Known Exploited Vulnerabilities and mine vendor / CVE / ransomware signals so a software owner can see **what to patch** and **why it is urgent**.

Navigation is desks, not a firehose. Filters live in the URL so a view can be bookmarked (`?desk=patch&risk=p0&stack=linux&ransomware=1&layer=12`).

## How to consume

Default is **Brief**.

| Desk | Use when |
| --- | --- |
| Brief | Clustered stories, 2+ sources first, topic/place/vendor chips. Lowest cognitive load. |
| Scan | Every item, dense cards. Raw desk. Click a source name to isolate that layer. |
| Pulse | Volume, topic mix, places, vendors. Pattern hunting. |
| Advisories | Cyber-classified items plus security RSS (CISA, Krebs, BleepingComputer, NCSC). |
| Patch | CISA KEV. Exploited CVEs, due dates, ransomware flag, filter to your stack. |
| Sources | Layers as objects: origin, item count, latest headline. Click a layer to scan it. |

Click a story to **read in place**. The pane is a dossier, not a shrink of the card: every contributing source’s full title and summary, then page extract, then related board stories and KEV hits. Topics, places, vendors, CVEs, and source names are all filters. Related stories and page links open forward; back / Esc walks the trail.

Filter with topic chips, location chips, vendor chips, ransomware, a **layer**, search, time range, and **2+ sources**. Search also matches mined CVE IDs.

**Follow next** on the right is auto-explore: hosts that keep showing up in coverage, one click to add as a layer.

## How the graph is linked

Sources are not a dump of unused handles. A source is a layer you chose (or auto-explored) with an origin (`self` / `follow` / `intel` / …). It only earns a place in a story when it actually published an item.

```
Source (layer, origin, freshness)
  └─ Item (title, summary, url, topics, places)
       mined → CVE, vendor, ransomware
  Story = items clustered by URL, shared CVE, or title overlap
  Story ─related─ Story (shared CVE / vendor / similar copy / same place+topic)
  Story ─KEV─ catalog row when a CVE is on both
```

Read-in-place walks that graph. Isolated sources with zero items are pool only — they do not corroborate anything until they fetch.

## Patch / risk (software owners)

CISA KEV is the exploited-in-the-wild catalog. That is the patch list; CVSS-only queues are mostly noise.

| Risk | Meaning |
| --- | --- |
| Patch now (P0) | Added to KEV in 21 days, due in the next 14 days, or ransomware use listed in 45 days |
| This window (P1) | Ransomware use, or added in 90 days |
| KEV backlog (P2) | Older exploited entries — still patch if you run the product |

Type your stack (`microsoft, openssl, chrome, apache`) to hide vulns that do not match vendor/product. Vendor chips and the ransomware toggle further slice both KEV and advisory copy.

NVD link opens in the reader pane. **KEV** button refreshes the catalog (cached 1h). **RSS** adds a public feed or discovers one from a site. **Options** stores default desk, range, stack, compact layout, and auto-load of security RSS / KEV.

**Load world RSS** now also includes DW, France 24, and Sky News. Relief adds GDACS and OCHA. **Load security RSS** includes CISA, CISA ICS, Krebs, BleepingComputer, The Record, NCSC UK, Schneier, Bellingcat, CFR, The Hacker News, Dark Reading, MSRC, CERT-EU.

This is not an asset inventory. It tells you what is being exploited and how soon CISA expects a fix; you still map that to the software you actually run.

Public APIs and RSS only. No recon scanners, maps, or unauthorized probing.

## What we take from Osiris (osirisai.live)

Osiris is a map/HUD that proxies many public feeds. Useful patterns for csmon: desks/layers, TTL-cached public CVE/KEV/news, keyword risk as a count not a model.

We reuse the **upstream public sources** (CISA, USGS-style RSS, vendor advisories), not Osiris’s own API and not RECON: no DNS/WHOIS/cert sweep, port scan, CCTV, flight maps, or `/api/osint/sweep`.

## Options

Browser-local (`localStorage` `csmon.options`): start desk, time range, stack, compact cards, auto-load security RSS, auto-load KEV. Shared links still override via the query string.

## Caching

Outbound fetches go through SQLite `fetch_cache` so refresh does not hammer the same RSS/KEV/HTML.

| kind | TTL |
| --- | --- |
| rss | 15 minutes |
| json | 30 minutes |
| kev | 1 hour |
| html | 6 hours |

Expired rows are deleted on read. The Sources desk shows live entry count and bytes.

## Flow

1. Load world/security RSS, scrape a Bluesky/RSS desk, or load KEV.
2. Pick a desk. Filter topics, places, vendors, stack, or a layer.
3. Open a story. Compare desks in the dossier, jump related coverage, walk back.

## Stack

- Next.js 16 App Router
- SQLite via Node `node:sqlite` (`data/csmon.sqlite`)
- Bluesky public AppView
- RSS/Atom, HTML article extract (`cheerio`)
- CISA KEV JSON catalog

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
| created_at | INTEGER NOT NULL | |

### source_origins

| column | type | notes |
| --- | --- | --- |
| id | INTEGER PK | |
| source_id | INTEGER NOT NULL | FK sources |
| seed_user_id | INTEGER NOT NULL | FK seed_users |
| reason | TEXT NOT NULL | `self` \| `follow` \| `mention` \| `link` \| `intel` \| `explore` |
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
| topics | TEXT NOT NULL | JSON, `002` |
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

TTL body cache for outbound RSS, JSON, KEV, and HTML (`004_fetch_cache`).

| column | type | notes |
| --- | --- | --- |
| cache_key | TEXT PK | e.g. `rss:https://…`, `kev:catalog` |
| kind | TEXT NOT NULL | `rss` \| `json` \| `kev` \| `html` |
| body | TEXT NOT NULL | raw response |
| fetched_at | INTEGER NOT NULL | unix ms |
| expires_at | INTEGER NOT NULL | unix ms |

## Migrations

- `001_init` — users, sources, origins, items
- `002_topics_locations` — `items.topics`, `items.locations` (skipped if columns already exist)
- `003_kev` — `kev` catalog table
- `004_fetch_cache` — `fetch_cache` TTL table
