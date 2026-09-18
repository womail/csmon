import { NextResponse } from "next/server";
import { getMonitorState, upsertScrape } from "@/lib/queries";
import { scrapeInput } from "@/lib/scrape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { input?: string };
    const input = body.input?.trim();
    if (!input) {
      return NextResponse.json({ error: "Paste a handle or URL." }, { status: 400 });
    }
    const result = await scrapeInput(input);
    const persisted = upsertScrape(result);
    return NextResponse.json({
      discovered: result.sources,
      user: result.user,
      sources: persisted.sources,
      state: getMonitorState(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scrape failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
