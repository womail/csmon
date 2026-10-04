import { fail, gate, jsonOk } from "@/lib/guard";
import { normalizeCweId } from "@/lib/cwe";
import { fetchCweBriefs } from "@/lib/cwe-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = gate(request, "cwe", 30);
  if (blocked) return blocked;
  const url = new URL(request.url);
  const list = url.searchParams.get("cwes") ?? url.searchParams.get("cwe") ?? "";
  const ids = list
    .split(",")
    .map((part) => normalizeCweId(part))
    .filter((id): id is string => Boolean(id));
  if (!ids.length) {
    return jsonOk({ error: "Pass ?cwes=CWE-502,CWE-79" }, 400);
  }
  try {
    const entries = await fetchCweBriefs(ids, 6);
    return jsonOk({ entries });
  } catch (error) {
    return fail(error, "CWE lookup failed");
  }
}
