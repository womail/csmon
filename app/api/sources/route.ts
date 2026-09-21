import { asIdList, fail, gate, jsonOk, readJson } from "@/lib/guard";
import { deleteSource, getMonitorState, setSourceEnabled } from "@/lib/queries";
import { refreshSources } from "@/lib/scrape/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const blocked = gate(request, "sources", 20);
  if (blocked) return blocked;
  try {
    const body = await readJson<{ enable?: unknown; disable?: unknown }>(request);
    const disable = asIdList(body.disable);
    const enable = asIdList(body.enable);
    if (disable.length) setSourceEnabled(disable, false);
    if (enable.length) {
      setSourceEnabled(enable, true);
      await refreshSources(enable);
    }
    return jsonOk(getMonitorState());
  } catch (error) {
    return fail(error, "Update failed");
  }
}

export async function DELETE(request: Request) {
  const blocked = gate(request, "sources", 20);
  if (blocked) return blocked;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return jsonOk({ error: "Missing id" }, 400);
  deleteSource(id);
  return jsonOk(getMonitorState());
}
