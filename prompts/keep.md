# Keep what already works

Review or continue work on csmon without undoing the parts that are already right. Read `csmon.md` and `SECURITY.md`. A change that breaks one of these needs an explicit reason in the reply.

## Product

- Desks, not a single feed. Home, Brief, Pulse, Weather, Advisories, Patch, and the tools rail each have a job. Custom desks are named filters on that rail.
- The investigation is a URL: desk, range, place, topic, layer, vendor, CVE, person, query. Copy link must reopen the same board.
- Read in place is a dossier: context chips, every contributing source, the page extract, related stories, and KEV or NVD when the item's own title or summary names a CVE. Page extracts do not pull unrelated CVEs into the patch panel.
- Corroboration counts independent origins (`lib/syndication.ts`), not layers. Wire copies and near-duplicate text fold. Cards show sources plus a syndicated remainder.
- Patch rank starts from CISA KEV. EPSS orders a long backlog. CVSS alone is not the queue.
- Article time is `published_at`. Items with no publish date stay hidden outside All.
- Reports and watch hits are kept when retention runs. Confidence and the full extract travel into the briefing.
- Ireland, the UK, and the US stay pinned. Place match includes the copy synonyms already documented, not only stored location tags.
- Help at `/help` is part of the product. If a screen changes, the shot and the paragraph change with it.

## Data path

- SQLite via `node:sqlite`, WAL, foreign keys, `CSMON_DATA_DIR`. Writes of items happen in a transaction.
- `fetch_cache` stores ETag and Last-Modified. A 304 re-arms the TTL. Manual refresh marks rows stale instead of deleting the validators.
- The scheduler refreshes due layers with a capped batch and exponential backoff. `CSMON_SCHEDULER=0` hands refresh back to the browser.
- Search can reach FTS extracts. The default board is still the newest 500 items plus a small search merge. Do not pretend a chip searched the whole corpus until the query does.

## Safety already in place

- User URLs go through `lib/public-url.ts` and `lib/safe-url.ts`: http(s) only, ports 80 and 443, no credentials, no private or link-local addresses, redirects re-checked, bodies capped.
- `CSMON_TOKEN` locks `/api/*` except health and session. Comparison is a hash plus `timingSafeEqual`. The cookie is HttpOnly and SameSite=Strict.
- CSP is a per-request nonce plus `strict-dynamic` in `proxy.ts`. Production does not allow `unsafe-eval`.
- Compose publishes `127.0.0.1:3000` unless `CSMON_PUBLISH_IP` is set. The image runs as uid 1001, drops capabilities, and sets `no-new-privileges`.
- Upstream errors do not echo raw URLs or status lines back to the browser (`lib/guard.ts` `fail`).

## Do not "improve" these into something else

Do not replace the URL filters with memory-only state. Do not collapse desks into one list. Do not rank Patch by CVSS. Do not count every syndicated layer as a source. Do not put auth in `proxy.ts`. Do not add a remote apply-update endpoint.
