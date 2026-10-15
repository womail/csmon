import { getAdvisoryFeedProbes } from "@/lib/advisory-feed-health";
import { fail, gate, jsonOk } from "@/lib/guard";
import { getSystemStats } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = gate(request, "stats", 60);
  if (blocked) return blocked;
  try {
    const force = new URL(request.url).searchParams.get("force") === "1";
    const stats = getSystemStats();
    const advisoryProbes = await getAdvisoryFeedProbes(force);
    return jsonOk({ ...stats, advisoryProbes });
  } catch (error) {
    return fail(error, "Could not load statistics");
  }
}
