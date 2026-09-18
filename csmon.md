# csmon

Current Situation Monitor. Harvest public sources, collapse them into a brief, and read in place. Patch mode ranks CISA Known Exploited Vulnerabilities so a software owner can see **what to patch** and **why it is urgent**.

## How to consume

Default is **Brief**, not a firehose.

| Mode | Use when |
| --- | --- |
| Brief | Clustered stories, 2+ sources first, topic/place chips. Lowest cognitive load. |
| Scan | Every item, dense cards. When you need the raw desk. |
| Pulse | Volume, topic mix, places. Pattern hunting. |
| Patch | CISA KEV. Exploited CVEs, due dates, ransomware flag, filter to your stack. |

Click a story to **read in place** (extracted text + source list + optional page view). Esc closes. You should not need to leave the board.

Filter with topic chips, location chips, search, time range, and **2+ sources** (only stories more than one desk covered).

**Follow next** on the right is auto-explore: hosts that keep showing up in coverage, one click to add as a layer.

## Patch / risk (software owners)

CISA KEV is the exploited-in-the-wild catalog. That is the patch list; CVSS-only queues are mostly noise.

| Risk | Meaning |
| --- | --- |
| Patch now (P0) | Added to KEV in 21 days, due in the next 14 days, or ransomware use listed in 45 days |
| This window (P1) | Ransomware use, or added in 90 days |
| KEV backlog (P2) | Older exploited entries — still patch if you run the product |

Type your stack (`microsoft, openssl, chrome, apache`) to hide vulns that do not match vendor/product.

NVD link opens in the reader pane. **KEV** button refreshes the catalog. **Load security RSS** adds CISA advisories, Bellingcat, CFR.

This is not an asset inventory. It tells you what is being exploited and how soon CISA expects a fix; you still map that to the software you actually run.

## Flow

1. Load world/security RSS, scrape a Bluesky/RSS desk, or load KEV.
2. Filter topics, places, stack.
3. Open a story or CVE in the reader. Follow related sources from there.

Public APIs and RSS only.

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

## Migrations

- `001_init` — users, sources, origins, items
- `002_topics_locations` — `items.topics`, `items.locations`
- `003_kev` — `kev` catalog table
