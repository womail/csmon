import { NextResponse } from "next/server";
import { probeHint } from "@/lib/explore";
import { getMonitorState, registerExploredSource } from "@/lib/queries";
import { refreshSources } from "@/lib/scrape/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      host: string;
      url: string;
      sample?: string;
    };
    if (!body.host || !body.url) {
      return NextResponse.json({ error: "Missing host" }, { status: 400 });
    }
    const probed = await probeHint({
      host: body.host,
      url: body.url,
      count: 1,
      sample: body.sample ?? "",
      feedUrl: null,
    });
    const id = registerExploredSource({
      name: probed.host,
      url: probed.url,
      feedUrl: probed.feedUrl,
      host: probed.host,
    });
    await refreshSources([id]);
    return NextResponse.json(getMonitorState());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Explore failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
