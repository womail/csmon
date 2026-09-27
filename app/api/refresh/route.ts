import { asIdList, fail, gate, jsonOk, readJson } from "@/lib/guard";
import { listEnabledSources } from "@/lib/queries";
import { monitorStateFromRequest } from "@/lib/monitor-state";
import { refreshSources } from "@/lib/scrape/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = gate(request, "refresh", 12);
  if (blocked) return blocked;
  try {
    const body = await readJson<{ ids?: unknown }>(request);
    const ids = asIdList(body.ids, 200);
    if (!ids.length && listEnabledSources().length === 0) {
      return fail(
        new Error("No enabled layers"),
        "No enabled layers. Use Load world RSS / Load security RSS on Home, or enable a layer under Sources.",
        400,
      );
    }
    const summary = await refreshSources(ids.length ? ids : undefined);
    if (summary.layers > 0 && summary.ok === 0) {
      return fail(
        new Error("All fetches failed"),
        "Refresh could not reach any feed (network/DNS from the container?). Check docker logs for refresh errors.",
        502,
      );
    }
    return jsonOk(monitorStateFromRequest(request));
  } catch (error) {
    return fail(error, "Refresh failed");
  }
}
