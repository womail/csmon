import { gate, jsonOk } from "@/lib/guard";
import { monitorStateFromRequest } from "@/lib/monitor-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const blocked = gate(request, "state", 60);
  if (blocked) return blocked;
  return jsonOk(monitorStateFromRequest(request));
}
