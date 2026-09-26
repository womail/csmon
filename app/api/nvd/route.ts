import { fail, gate, jsonOk } from "@/lib/guard";
import { normalizeCveId } from "@/lib/nvd";
import { fetchNvdCves } from "@/lib/nvd-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = gate(request, "nvd", 30);
  if (blocked) return blocked;
  const url = new URL(request.url);
  const single = url.searchParams.get("cve");
  const list = url.searchParams.get("cves");
  const ids: string[] = [];
  if (single) {
    const id = normalizeCveId(single);
    if (id) ids.push(id);
  }
  if (list) {
    for (const part of list.split(",")) {
      const id = normalizeCveId(part);
      if (id) ids.push(id);
    }
  }
  if (!ids.length) {
    return fail(new Error("Missing cve"), "Pass ?cve=CVE-2024-0001 or ?cves=CVE-1,CVE-2", 400);
  }
  try {
    const entries = await fetchNvdCves(ids, 5);
    return jsonOk({ entries });
  } catch (error) {
    return fail(error, "NVD lookup failed");
  }
}
