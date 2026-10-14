import { normalizeGdeltQueries } from "@/lib/gdelt";
import { gdeltIngestDisabledReason, gdeltIngestEnabled } from "@/lib/ingest-flags";
import { fail, gate, jsonOk, readJson } from "@/lib/guard";
import { monitorStateFromRequest } from "@/lib/monitor-state";
import { registerGdeltQueries } from "@/lib/queries";
import { refreshSources } from "@/lib/scrape/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const blocked = gate(request, "gdelt", 6);
  if (blocked) return blocked;
  try {
    if (!gdeltIngestEnabled()) {
      return jsonOk({ error: gdeltIngestDisabledReason() }, 503);
    }
    const body = await readJson<{ queries?: unknown }>(request);
    if (!Array.isArray(body.queries)) return jsonOk({ error: "Send a list of GDELT queries." }, 400);
    const queries = normalizeGdeltQueries(body.queries);
    if (!queries.length && body.queries.length > 0) {
      return jsonOk({ error: "Each GDELT query needs a name and a search." }, 400);
    }
    const ids = registerGdeltQueries(queries);
    let gdeltRefresh: { ok: number; failed: number; errors: string[] } | undefined;
    if (ids.length) {
      const result = await refreshSources(ids);
      gdeltRefresh = { ok: result.ok, failed: result.failed, errors: result.errors };
      if (result.failed > 0 && result.ok === 0 && result.itemsAdded === 0) {
        const message =
          result.errors.find((error) => /GDELT/i.test(error)) ??
          result.errors[0] ??
          "GDELT did not return articles. It allows about one request every 5 seconds.";
        return jsonOk({ error: message, gdeltRefresh, ...monitorStateFromRequest(request) }, 502);
      }
    }
    return jsonOk({ ...monitorStateFromRequest(request), ...(gdeltRefresh ? { gdeltRefresh } : {}) });
  } catch (error) {
    return fail(error, "GDELT feed failed");
  }
}
