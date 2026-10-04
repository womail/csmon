import { fail, gate, jsonOk, readJson } from "@/lib/guard";
import { parsePublicHttpUrl } from "@/lib/public-url";
import { ackWatchlist, createWatchlist, deleteWatchlist, listWatchlists } from "@/lib/watchlists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const blocked = gate(request, "watchlists", 40);
  if (blocked) return blocked;
  return jsonOk({ watches: listWatchlists() });
}

export async function POST(request: Request) {
  const blocked = gate(request, "watchlists-write", 20);
  if (blocked) return blocked;
  try {
    const body = await readJson<{
      name?: string;
      query?: string;
      notifyUrl?: string | null;
      desk?: string | null;
      ack?: number;
      delete?: number;
    }>(request);
    if (typeof body.ack === "number" && body.ack > 0) {
      ackWatchlist(body.ack);
      return jsonOk({ watches: listWatchlists() });
    }
    if (typeof body.delete === "number" && body.delete > 0) {
      deleteWatchlist(body.delete);
      return jsonOk({ watches: listWatchlists() });
    }
    const query = body.query?.trim() ?? "";
    if (!query) return jsonOk({ error: "Watch needs a query." }, 400);
    if (body.notifyUrl?.trim()) parsePublicHttpUrl(body.notifyUrl.trim());
    const watch = createWatchlist({
      name: body.name ?? query,
      query,
      notifyUrl: body.notifyUrl ?? null,
      desk: body.desk ?? null,
    });
    return jsonOk({ watch, watches: listWatchlists() });
  } catch (error) {
    return fail(error, "Could not update watchlists");
  }
}
