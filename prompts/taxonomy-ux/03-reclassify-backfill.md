# 03 — Re-score stored items without losing manual choices

Depends on: 02.

## Why

21,504 stored rows carry topics from the old classifier. Right-click **Reclassify** (`app/api/items/reclassify/route.ts`) writes the user's choice straight into `items.topics`, so a naive re-run would overwrite it. Users must never lose a correction they made by hand.

## Schema — migration `008_topic_lock`

In `lib/db.ts`, add (only when missing, same pattern as `ensureFetchHealthColumns`):

| table | column | type | notes |
| --- | --- | --- | --- |
| items | `topics_locked` | INTEGER NOT NULL DEFAULT 0 | 1 = user reclassified; the classifier never overwrites topics/tags |
| items | `classifier_version` | INTEGER NOT NULL DEFAULT 0 | version of `lib/topic-rules.ts` that produced the stored topics |

Index: `CREATE INDEX IF NOT EXISTS idx_items_classifier ON items(classifier_version, topics_locked)`.

Document both columns in `csmon.md` → **Schema → items** and add `008_topic_lock` under **Migrations**.

## Steps

1. Export `CLASSIFIER_VERSION = 2` from `lib/topic-rules.ts`. Bump it whenever rules change (task 05 bumps it to 3 for places).
2. `insertItems` (`lib/queries.ts`) writes `classifier_version = CLASSIFIER_VERSION` on insert. On the `ON CONFLICT … DO UPDATE` path, leave `topics`/`tags` untouched when `items.topics_locked = 1` (use `CASE WHEN items.topics_locked = 1 THEN items.topics ELSE excluded.topics END`).
3. `app/api/items/reclassify/route.ts`: also set `topics_locked = 1`.
4. Browser overrides: `lib/item-overrides.ts` keeps `csmon.item-topic-overrides`. Add a one-time sync: on board load, if that key has entries and `csmon.item-topic-overrides-synced` is not set, POST the ids and topics to `/api/items/reclassify` (one request with an array; extend the route to accept `{ items: [{ itemId, topics }] }`, max 500) then set the synced flag. After that the server is the source of truth and the localStorage copy is a cache.
5. New `lib/reclassify-backfill.ts` (`import "server-only"`):

   ```ts
   export function pendingReclassifyCount(): number;
   /** Re-score up to `limit` rows whose classifier_version < CLASSIFIER_VERSION and topics_locked = 0. */
   export function reclassifyBatch(limit = 1000): { updated: number; changed: number; remaining: number };
   ```

   - Select `id, source_id, title, summary` ordered by `id DESC` (newest first so the board improves first).
   - Build the `TopicHint` from the source row (handle, feed_url, category once task 06 lands, language if known from `extracts.language`).
   - Update `topics`, `tags`, `locations`, `classifier_version` in one transaction per batch.
   - Re-index entities for changed rows: delete from `item_entities` for that item and call `indexItemEntities` again (`lib/entities.ts`).
   - Count `changed` when the topic set differs.
6. Run it automatically: `lib/scheduler.ts` tick calls `reclassifyBatch(2000)` when `pendingReclassifyCount() > 0`, after the fetch work. At 60 s per tick the current corpus finishes in about 11 minutes.
7. Manual control: `GET /api/items/reclassify-all` → `{ pending, version }`; `POST` → runs batches until 10 s have passed and returns `{ updated, changed, remaining }`. `gate()` on both. In **Options → Data**, add a row **Classifier** showing "Version 2 · 1,204 items waiting" and a **Re-score now** button that POSTs until `remaining` is 0, with a progress line. When nothing is waiting: "All items use classifier version 2."
8. Reclassify menu: show a small lock mark on cards whose topics are locked, with the tooltip "You set these topics. Reclassify again to change them." Add **Reset to automatic** in the Reclassify submenu: clears the lock and re-scores that one item.

## Acceptance

- After the backfill completes, re-run the corpus measurement from task 02 against stored rows (no re-scoring in the script): numbers match the scorer's.
- An item you reclassified before the migration still shows your topics after the backfill.
- `items.classifier_version` is 2 on every unlocked row.
- `csmon.md` explains the lock, the automatic re-score, and the Options control.
