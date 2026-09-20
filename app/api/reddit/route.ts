import { NextResponse } from "next/server";
import { getMonitorState, registerRedditFeed } from "@/lib/queries";
import { uniqueSubreddits } from "@/lib/reddit";
import { refreshSources } from "@/lib/scrape/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      subs?: unknown;
      enable?: boolean;
    };
    const subs = uniqueSubreddits(Array.isArray(body.subs) ? body.subs.map((value) => String(value)) : []);
    const enable = body.enable !== false;
    if (enable && !subs.length) {
      return NextResponse.json({ error: "Add at least one subreddit." }, { status: 400 });
    }
    const ids = registerRedditFeed(subs, enable);
    if (enable) await refreshSources(ids);
    return NextResponse.json(getMonitorState());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reddit feed failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
