# Develop csmon

You are working in the csmon repo, a local current-situation monitor. Read `csmon.md` and `SECURITY.md` before editing. Match the code that is already there.

## What this app is

Harvest public sources, collapse them into desks, and read in place. Home is the start: weather, earthquakes, war, civil unrest, and a map of where coverage relates. Cyber desks rank CISA KEV and show why a CVE is urgent. Navigation is desks, not a firehose. Filters live in the URL so a view can be bookmarked.

Public RSS, JSON, and HTML only. No recon, no port scans, no DNS or certificate sweeps, no CCTV, no unofficial scrape proxies.

## How to add something

- A new `/api/*` route calls `gate()` from `lib/guard.ts` on every handler. `/api/health` and `/api/session` are the exceptions. `/api/version` is currently ungated; gate it if you touch that file.
- Outbound HTTP goes through `fetchOutbound` in `lib/safe-url.ts` (or `lib/http.ts`, which uses it). Do not call `fetch` on a user-supplied or operator-supplied URL.
- New columns or tables get a migration in `lib/db.ts` and a matching section in `csmon.md`.
- Board filters stay in the query string. A control that cannot be bookmarked is unfinished.
- Maps are their own panes. Do not put a map behind article text.
- Clustering, syndication, and the query line are pure functions. If you change them, add a Node test and wire it to `pnpm test` if that script does not exist yet.
- Prefer a small module over another hundred lines in `components/monitor/monitor.tsx`.

## Shape of a change

1. Name the desk, filter, or table the user will actually use.
2. Keep the URL, the reader, and SQLite in agreement. Reports and watches already live in SQLite. Layout preferences stay in the browser.
3. Document the user-visible behavior in `csmon.md` when the desk, schema, or fetch rules change.
4. Verify a UI change in the browser: the desk you touched, the reader if it shares that state, and the empty and error path.

## Leave alone unless asked

Accounts, SSO, a second map library, remote code that applies updates, and any scanner. `GET /api/update` checks only. Apply stays `scripts/update.sh` on the host.
