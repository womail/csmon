import { NextResponse } from "next/server";
import { INTEL_FEEDS, type IntelPack } from "@/lib/intel-feeds";
import { getMonitorState, registerIntelFeeds } from "@/lib/queries";
import { refreshSources } from "@/lib/scrape/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ feeds: INTEL_FEEDS });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      pack?: IntelPack | "all";
      enable?: boolean;
    };
    const pack = body.pack ?? "core";
    const feeds =
      pack === "all"
        ? INTEL_FEEDS
        : INTEL_FEEDS.filter((feed) => feed.pack === pack);
    const enable = body.enable !== false;
    const ids = registerIntelFeeds(feeds, enable);
    if (enable) await refreshSources(ids);
    return NextResponse.json(getMonitorState());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Intel pack failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
