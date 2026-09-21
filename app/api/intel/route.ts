import { INTEL_FEEDS, type IntelPack } from "@/lib/intel-feeds";
import { fail, gate, jsonOk, readJson } from "@/lib/guard";
import { getMonitorState, registerIntelFeeds } from "@/lib/queries";
import { refreshSources } from "@/lib/scrape/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PACKS = new Set<IntelPack | "all">([
  "core",
  "relief",
  "security",
  "hazard",
  "tech",
  "markets",
  "sports",
  "all",
]);

export async function GET(request: Request) {
  const blocked = gate(request, "intel-get", 60);
  if (blocked) return blocked;
  return jsonOk({ feeds: INTEL_FEEDS });
}

export async function POST(request: Request) {
  const blocked = gate(request, "intel", 20);
  if (blocked) return blocked;
  try {
    const body = await readJson<{ pack?: string; enable?: boolean }>(request);
    const pack = PACKS.has(body.pack as IntelPack | "all") ? (body.pack as IntelPack | "all") : "core";
    const feeds = pack === "all" ? INTEL_FEEDS : INTEL_FEEDS.filter((feed) => feed.pack === pack);
    const enable = body.enable !== false;
    const ids = registerIntelFeeds(feeds, enable);
    if (enable) await refreshSources(ids);
    return jsonOk(getMonitorState());
  } catch (error) {
    return fail(error, "Intel pack failed");
  }
}
