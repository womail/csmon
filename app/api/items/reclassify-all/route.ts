import { fail, gate, jsonOk } from "@/lib/guard";
import { pendingReclassifyCount, reclassifyBatch } from "@/lib/reclassify-backfill";
import { CLASSIFIER_VERSION } from "@/lib/topic-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUDGET_MS = 10_000;

export async function GET(request: Request) {
  const blocked = gate(request, "items", 60);
  if (blocked) return blocked;
  return jsonOk({ pending: pendingReclassifyCount(), version: CLASSIFIER_VERSION });
}

/** Re-score batches for up to 10 s; the client repeats until `remaining` is 0. */
export async function POST(request: Request) {
  const blocked = gate(request, "items", 30);
  if (blocked) return blocked;
  try {
    const started = Date.now();
    let updated = 0;
    let changed = 0;
    let remaining = pendingReclassifyCount();
    while (remaining > 0 && Date.now() - started < BUDGET_MS) {
      const batch = reclassifyBatch(1000);
      updated += batch.updated;
      changed += batch.changed;
      remaining = batch.remaining;
      if (!batch.updated) break;
    }
    return jsonOk({ updated, changed, remaining, version: CLASSIFIER_VERSION });
  } catch (error) {
    return fail(error, "Re-score failed", 500);
  }
}
