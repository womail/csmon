import { fail, gate, jsonOk } from "@/lib/guard";
import { fetchOsvSummary } from "@/lib/vuln-intel-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = gate(request, "osv", 30);
  if (blocked) return blocked;
  const list = new URL(request.url).searchParams.get("cves") ?? "";
  const ids = [...new Set(list.split(",").map((id) => id.trim()).filter(Boolean))].slice(0, 4);
  if (!ids.length) return fail(new Error("Missing cves"), "Pass ?cves=CVE-1,CVE-2", 400);
  try {
    const rows = await Promise.all(ids.map((id) => fetchOsvSummary(id).catch(() => null)));
    return jsonOk({ entries: rows.filter(Boolean) });
  } catch (error) {
    return fail(error, "OSV lookup failed");
  }
}
