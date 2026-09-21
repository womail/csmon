import { fail, gate, jsonOk } from "@/lib/guard";
import { fetchKevCatalog } from "@/lib/kev-fetch";
import { getMonitorState, replaceKev } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = gate(request, "kev", 8);
  if (blocked) return blocked;
  try {
    const entries = await fetchKevCatalog();
    replaceKev(entries);
    return jsonOk(getMonitorState());
  } catch (error) {
    return fail(error, "KEV fetch failed");
  }
}
