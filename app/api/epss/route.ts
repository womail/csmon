import { fail, gate, jsonOk } from "@/lib/guard";
import { fetchEpssScores } from "@/lib/vuln-intel-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = gate(request, "epss", 30);
  if (blocked) return blocked;
  const list = new URL(request.url).searchParams.get("cves") ?? "";
  const ids = list.split(",").map((id) => id.trim()).filter(Boolean);
  if (!ids.length) return fail(new Error("Missing cves"), "Pass ?cves=CVE-1,CVE-2", 400);
  try {
    return jsonOk({ scores: await fetchEpssScores(ids) });
  } catch (error) {
    return fail(error, "EPSS lookup failed");
  }
}
