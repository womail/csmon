import { fail, gate, jsonOk, readJson } from "@/lib/guard";
import { registerRedditFeed } from "@/lib/queries";
import { monitorStateFromRequest } from "@/lib/monitor-state";
import { uniqueSubreddits } from "@/lib/reddit";
import { refreshSources } from "@/lib/scrape/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = gate(request, "reddit", 10);
  if (blocked) return blocked;
  try {
    const body = await readJson<{ subs?: unknown; enable?: boolean }>(request);
    const subs = uniqueSubreddits(Array.isArray(body.subs) ? body.subs.map((value) => String(value)) : []);
    const enable = body.enable !== false;
    if (enable && !subs.length) return jsonOk({ error: "Add at least one subreddit." }, 400);
    const ids = registerRedditFeed(subs, enable);
    if (enable) await refreshSources(ids);
    return jsonOk(monitorStateFromRequest(request));
  } catch (error) {
    return fail(error, "Reddit feed failed");
  }
}
