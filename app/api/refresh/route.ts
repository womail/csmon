import { asIdList, fail, gate, jsonOk, readJson } from "@/lib/guard";
import { getMonitorState } from "@/lib/queries";
import { refreshSources } from "@/lib/scrape/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = gate(request, "refresh", 12);
  if (blocked) return blocked;
  try {
    const body = await readJson<{ ids?: unknown }>(request);
    const ids = asIdList(body.ids, 200);
    await refreshSources(ids.length ? ids : undefined);
    return jsonOk(getMonitorState());
  } catch (error) {
    return fail(error, "Refresh failed");
  }
}
