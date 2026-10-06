import { fail, gate, jsonOk } from "@/lib/guard";
import { getSystemStats } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = gate(request, "stats", 60);
  if (blocked) return blocked;
  try {
    return jsonOk(getSystemStats());
  } catch (error) {
    return fail(error, "Could not load statistics");
  }
}
