import { fail, gate, jsonOk, readJson } from "@/lib/guard";
import { appLog, deleteAppLogs, listAppLogs, setLoggingEnabled } from "@/lib/app-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = gate(request, "logs", 60);
  if (blocked) return blocked;
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit"));
  return jsonOk(listAppLogs(Number.isFinite(limit) ? limit : 200));
}

export async function PATCH(request: Request) {
  const blocked = gate(request, "logs-write", 20);
  if (blocked) return blocked;
  try {
    const body = await readJson<{ enabled?: unknown }>(request);
    if (typeof body.enabled !== "boolean") {
      return fail(new Error("Missing enabled"), "Set enabled true or false.", 400);
    }
    if (body.enabled) {
      setLoggingEnabled(true);
      appLog("info", "logging", "Diagnostic logging turned on");
    } else {
      appLog("info", "logging", "Diagnostic logging turned off");
      setLoggingEnabled(false);
    }
    return jsonOk(listAppLogs());
  } catch (error) {
    return fail(error, "Could not update logging");
  }
}

export async function DELETE(request: Request) {
  const blocked = gate(request, "logs-write", 20);
  if (blocked) return blocked;
  try {
    const body = await readJson<{ ids?: unknown }>(request);
    const ids = Array.isArray(body.ids)
      ? body.ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
      : undefined;
    const result = deleteAppLogs(ids?.length ? ids : undefined);
    return jsonOk({ ...listAppLogs(), ...result });
  } catch (error) {
    return fail(error, "Could not delete logs");
  }
}
