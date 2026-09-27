import { fail, gate, jsonOk, readJson } from "@/lib/guard";
import { upsertScrape } from "@/lib/queries";
import { monitorStateFromRequest } from "@/lib/monitor-state";
import { scrapeInput } from "@/lib/scrape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = gate(request, "scrape", 8);
  if (blocked) return blocked;
  try {
    const body = await readJson<{ input?: string; mode?: "auto" | "rss" | "bsky" }>(request);
    const input = body.input?.trim() ?? "";
    if (!input) return jsonOk({ error: "Paste a handle or URL." }, 400);
    if (input.length > 2048) return jsonOk({ error: "Paste a handle or URL." }, 400);
    const mode = body.mode === "rss" || body.mode === "bsky" ? body.mode : "auto";
    const result = await scrapeInput(input, mode);
    const persisted = upsertScrape(result);
    return jsonOk({
      discovered: result.sources,
      user: result.user,
      sources: persisted.sources,
      state: monitorStateFromRequest(request),
    });
  } catch (error) {
    return fail(error, "Scrape failed");
  }
}
