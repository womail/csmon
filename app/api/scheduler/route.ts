import { fail, gate, jsonOk } from "@/lib/guard";
import { schedulerStatus } from "@/lib/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = gate(request, "scheduler", 60);
  if (blocked) return blocked;
  try {
    return jsonOk(schedulerStatus());
  } catch (error) {
    return fail(error, "Could not read scheduler status");
  }
}
