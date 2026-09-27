import { probeHint } from "@/lib/explore";
import { fail, gate, jsonOk, readJson } from "@/lib/guard";
import { parsePublicHttpUrl } from "@/lib/public-url";
import { registerExploredSource } from "@/lib/queries";
import { monitorStateFromRequest } from "@/lib/monitor-state";
import { refreshSources } from "@/lib/scrape/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = gate(request, "explore", 8);
  if (blocked) return blocked;
  try {
    const body = await readJson<{ host?: string; url?: string; sample?: string }>(request);
    if (!body.host || !body.url) return jsonOk({ error: "Missing host" }, 400);
    const parsed = parsePublicHttpUrl(body.url);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const claimed = String(body.host).replace(/^www\./i, "").toLowerCase().slice(0, 253);
    if (claimed !== host) return jsonOk({ error: "Host does not match URL." }, 400);
    const probed = await probeHint({
      host,
      url: parsed.toString(),
      count: 1,
      sample: String(body.sample ?? "").slice(0, 280),
      feedUrl: null,
    });
    const id = registerExploredSource({
      name: probed.host,
      url: probed.url,
      feedUrl: probed.feedUrl,
      host: probed.host,
    });
    await refreshSources([id]);
    return jsonOk(monitorStateFromRequest(request));
  } catch (error) {
    return fail(error, "Explore failed");
  }
}
