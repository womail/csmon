# Taxonomy, connections, and filter UX — implementation plan

Instructions for an implementing agent (Composer 2.5). Work through the files **in order**. Each file is one reviewable change: do it, verify it, update `csmon.md`, then stop and report before the next file.

| # | File | Outcome for the user |
| --- | --- | --- |
| 01 | [01-test-harness.md](01-test-harness.md) | `pnpm test` exists; classifier changes are checked against real headlines |
| 02 | [02-topic-classifier.md](02-topic-classifier.md) | Topics are right: a Splunk advisory is cyber, not health; a Premier League "summit" is sports, not diplomacy |
| 03 | [03-reclassify-backfill.md](03-reclassify-backfill.md) | Old rows are re-scored; manual Reclassify choices survive |
| 04 | [04-one-topic-truth.md](04-one-topic-truth.md) | Chips, lanes, Pulse, and the map all agree, because they all read one stored answer |
| 05 | [05-places.md](05-places.md) | "Tell us" stops pinning stories to the US; Hamas is an actor, Gaza is a place |
| 06 | [06-source-categories.md](06-source-categories.md) | Every layer has a category and a type (CERT, vendor, wire, outlet…); OPML folders show up on Feeds and as filters |
| 07 | [07-people-and-orgs.md](07-people-and-orgs.md) | People splits into **Bylines** and **In the news**; feed titles stop appearing as people; orgs and threat actors become filters |
| 08 | [08-facet-model.md](08-facet-model.md) | One Active row shows every filter that is on, the search line and chips round-trip, Clear clears what you see |
| 09 | [09-connections.md](09-connections.md) | "Often with" suggestions, a **Connected** panel in the reader, and an entity dossier for any person/org/vendor/place |
| 10 | [10-topic-families.md](10-topic-families.md) | Topics grouped into families (Security, Conflict, Hazards…) on chips, lanes, and Tune |
| 11 | [11-palette-and-trail.md](11-palette-and-trail.md) | Ctrl+K pivots to any entity; a filter trail with back/forward; csmon offers to save a view you keep returning to |

Files 01–05 fix correctness and should land first. 06–07 add the data the UX work needs. 08–11 are the interface.

## Rules for every task

1. Read `csmon.md`, `AGENTS.md`, `prompts/develop.md`, and `prompts/keep.md` before editing. This repo runs **Next.js 16.3.5**; check `node_modules/next/dist/docs/` before using a Next API you have not seen in this tree.
2. pnpm only. Node 26. TypeScript strict. Match surrounding code style (two-space indent, double quotes, named exports, small `lib/*.ts` modules).
3. Prefer a new small module in `lib/` over more lines in `components/monitor/monitor.tsx` (4,272 lines). When a task touches `monitor.tsx`, move logic out rather than in.
4. Board filters live in the URL (`lib/board-state.ts`). Any new filter must parse, serialize, and survive **Copy link**. Existing URLs must keep working.
5. Schema changes are a numbered migration in `lib/db.ts` (`008_…`, `009_…`) using `ADD COLUMN` only when missing, plus a section in `csmon.md` → **Schema** and **Migrations**.
6. Public RSS/JSON/HTML only. Outbound HTTP goes through `lib/safe-url.ts` / `lib/http.ts`.
7. Copy and labels use plain, affirmative sentences. Say what a control does.
8. After each task: `pnpm exec tsc --noEmit --pretty false --incremental false`, `pnpm lint`, `pnpm test` (from task 01 on). Then verify in the browser at `http://127.0.0.1:3000` (`pnpm dev` if nothing is listening; never kill a server you did not start). If the embedded browser loads HTML but React never hydrates (clicks do nothing, also true on `/help`), say so and verify through the API with `curl` plus the unit tests.
9. Update `csmon.md` for every user-visible change. Do not commit unless the user asks.
10. Do not invent risk scores, model calls, or scheduled LLM text. Everything here is deterministic.

## Evidence (live corpus, 24 Oct 2026, 21,504 items, 218 layers)

These numbers motivated the plan. Re-run the queries in 02 and 05 after your change and report the new numbers.

- **health** is on 1,237 items; 1,023 of them (83%) have no health word. Cause: `/who\b/i` matches the English word "who". Samples: Splunk SVD advisories, "Patch Tuesday – October 2026".
- **conflict** is on 3,183 items; 2,475 have no `war` topic and 460 are also `cyber`. Cause: `\battack` and `drone` fire on vulnerability write-ups (every ZDI advisory).
- **diplomacy**: "Arsenal join Man City at Premier League summit"; CERT-FR French titles match `un\b` ("un" is French for "a").
- **sports + cyber** on the same item: "Defender Exclusion Abuse: How Attackers Hide Malware from MDAV" (`defender` is a sports word in the regex); NFL team names (`bills`, `jets`, `chiefs`, `commanders`, `cardinals`, `giants`) fire in politics and defense copy; basketball fires on `heat`.
- **war** on "The Endless Chip War", "Etsy … effort to combat seller slop", "Chrome … defenses".
- **world** is the fallback topic on 6,972 items (32%). It carries no meaning but shows as a chip.
- **Place US** on 702 items, including every "ISC Stormcast" (the regex `\bu\.?s\.a?\b` matches the word "us").
- **People entities**: "The New York Times" (598), "MSRC Security Update Guide" (272), "CISA" (201), "The Verge", "rat king 🐀 👑" are stored as people. RSS ingest uses the **feed title** as the author when an item has no creator (`lib/scrape/rss.ts`).
- **Org entities**: only 12 distinct orgs are ever mined (static list) and the UI never shows them.
- **Source categories**: the 41 ThreatFilter OPML layers carry their folder ("CERTs & Government Advisories", "Endpoint & EDR Vendors"…) only in `sources.description`. The Feeds desk files all of them under "Added by you".
- **Filter-time regex**: `itemHasTopic` (`lib/classify.ts`) re-tests the topic regex against title + summary + extract + URL, and `matchesLane` (`lib/lanes.ts`) has a third, different keyword list. Fixing stored topics alone would not change what the board shows; task 04 fixes that after task 03 has re-scored the stored rows.

## How to hand a task to the implementing agent

Paste this, replacing the file name:

> Read `prompts/taxonomy-ux/README.md`, then implement `prompts/taxonomy-ux/02-topic-classifier.md` exactly. Follow "Rules for every task". When done, report: files changed, test output, the before/after numbers the task asks for, what you verified in the browser (or why you could not), and anything in the task you chose not to do and why. Do not start the next task.
