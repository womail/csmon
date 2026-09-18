# csmon

Current Situation Monitor. Scrape public users (Bluesky, RSS, websites) to discover sources, filter them, and display items on a dense layered board.

## Flow

1. Paste a Bluesky handle, profile URL, RSS URL, or website.
2. csmon scrapes that user/page for sources: the account itself, accounts they follow, accounts they mention, and sites they link (RSS auto-discovered when possible).
3. Filter discovered sources by reason, weight, and search; enable the ones you want as **layers**.
4. Items from enabled layers render as compact tagged cards. More than 13 enabled layers shows a performance notice.

Public APIs and RSS only. No login, no scraping of private or gated data.

## Stack

- Next.js 16 App Router
- SQLite via Node `node:sqlite` (`data/csmon.sqlite`)
- Bluesky public AppView (`public.api.bsky.app`)
- RSS/Atom via `rss-parser`, feed autodiscovery via `cheerio`

## Schema

Initial migration `001_init` (applied automatically on first DB open).

### seed_users

People or feeds you asked csmon to scrape.

| column | type | notes |
| --- | --- | --- |
| id | INTEGER PK | |
| handle | TEXT NOT NULL | canonical handle or host |
| platform | TEXT NOT NULL | `bluesky` \| `rss` \| `web` |
| did | TEXT | Bluesky DID when known |
| display_name | TEXT | |
| avatar_url | TEXT | |
| description | TEXT | |
| profile_url | TEXT NOT NULL | |
| last_scraped_at | INTEGER | unix ms |
| created_at | INTEGER NOT NULL | unix ms |

### sources

Display layers. A source is enabled (`enabled = 1`) when it should appear on the board.

| column | type | notes |
| --- | --- | --- |
| id | INTEGER PK | |
| key | TEXT NOT NULL UNIQUE | `platform:handle-or-url` |
| name | TEXT NOT NULL | |
| handle | TEXT | |
| url | TEXT NOT NULL | profile or site |
| feed_url | TEXT | RSS/Atom URL when known |
| platform | TEXT NOT NULL | `bluesky` \| `rss` \| `web` |
| kind | TEXT NOT NULL | `account` \| `feed` \| `site` |
| description | TEXT | |
| avatar_url | TEXT | |
| color | TEXT NOT NULL | layer color |
| enabled | INTEGER NOT NULL | 0/1 |
| last_fetched_at | INTEGER | unix ms |
| created_at | INTEGER NOT NULL | unix ms |

### source_origins

Why a source was discovered from a seed user.

| column | type | notes |
| --- | --- | --- |
| id | INTEGER PK | |
| source_id | INTEGER NOT NULL | FK sources |
| seed_user_id | INTEGER NOT NULL | FK seed_users |
| reason | TEXT NOT NULL | `self` \| `follow` \| `mention` \| `link` |
| weight | INTEGER NOT NULL | mention count, 100 for self, 2 for follow |
| UNIQUE(source_id, seed_user_id, reason) | | |

### items

Scraped posts/headlines shown on the board.

| column | type | notes |
| --- | --- | --- |
| id | INTEGER PK | |
| source_id | INTEGER NOT NULL | FK sources |
| external_id | TEXT NOT NULL | URI/guid |
| title | TEXT NOT NULL | |
| summary | TEXT | |
| url | TEXT NOT NULL | |
| author | TEXT | |
| published_at | INTEGER | unix ms |
| tags | TEXT NOT NULL | JSON string array |
| fetched_at | INTEGER NOT NULL | unix ms |
| UNIQUE(source_id, external_id) | | |

Indexes: `items(published_at DESC)`, `items(source_id)`.

## Migrations

- `001_init` — tables above
