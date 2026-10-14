import { fetchJson } from "@/lib/http";
import { gate, jsonOk } from "@/lib/guard";
import {
  EONET_EVENTS,
  IODA_SUMMARY,
  parseEonet,
  parseIodaSummary,
  type NaturalEvent,
  type OutageRow,
} from "@/lib/hazards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = gate(request, "hazards", 30);
  if (blocked) return blocked;
  const until = Math.floor(Date.now() / 1000);
  const from = until - 24 * 60 * 60;
  const hour = Math.floor(until / 3600) * 3600;
  const [natural, outages] = await Promise.all([
    fetchJson<unknown>(EONET_EVENTS, 15000)
      .then((body) => parseEonet(body))
      .catch((): NaturalEvent[] => []),
    fetchJson<unknown>(
      `${IODA_SUMMARY}?from=${from - (from % 3600)}&until=${hour}&entityType=country&limit=15`,
      15000,
    )
      .then((body) => parseIodaSummary(body))
      .catch((): OutageRow[] => []),
  ]);
  return jsonOk({ natural, outages });
}
