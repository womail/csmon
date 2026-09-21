import { NextRequest } from "next/server";
import { bboxAround, kmBetween } from "@/lib/geo";
import { asCoords, fail, gate, jsonOk } from "@/lib/guard";
import { fetchLiveJson } from "@/lib/http";
import type { Flight } from "@/lib/flights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENSKY = "https://opensky-network.org/api/states/all";

type OpenSky = {
  states?: (string | number | boolean | null)[][] | null;
};

function parseStates(states: (string | number | boolean | null)[][] | null | undefined): Flight[] {
  const flights: Flight[] = [];
  for (const row of states ?? []) {
    const icao24 = String(row[0] ?? "").trim().toLowerCase();
    const lat = Number(row[6]);
    const lng = Number(row[5]);
    if (!icao24 || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    flights.push({
      icao24,
      callsign: String(row[1] ?? "").trim(),
      country: String(row[2] ?? ""),
      lat,
      lng,
      altitude: typeof row[7] === "number" ? row[7] : typeof row[13] === "number" ? row[13] : null,
      speed: typeof row[9] === "number" ? row[9] : null,
      heading: typeof row[10] === "number" ? row[10] : null,
      onGround: Boolean(row[8]),
    });
  }
  return flights.filter((flight) => !flight.onGround);
}

function sampleSpread(flights: Flight[], limit: number) {
  if (flights.length <= limit) return flights;
  const buckets = new Map<string, Flight[]>();
  for (const flight of flights) {
    const key = `${Math.round(flight.lat / 8)}:${Math.round(flight.lng / 8)}`;
    const rows = buckets.get(key) ?? [];
    rows.push(flight);
    buckets.set(key, rows);
  }
  const out: Flight[] = [];
  const lists = [...buckets.values()];
  let i = 0;
  while (out.length < limit && lists.some((rows) => rows.length > i)) {
    for (const rows of lists) {
      if (rows[i]) out.push(rows[i]);
      if (out.length >= limit) break;
    }
    i += 1;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const blocked = gate(req, "flights", 30);
  if (blocked) return blocked;
  const point = asCoords(req.nextUrl.searchParams.get("lat"), req.nextUrl.searchParams.get("lng"));
  const km = Math.min(400, Math.max(25, Number(req.nextUrl.searchParams.get("km") || 100) || 100));
  const local = point != null;
  try {
    const url = local
      ? (() => {
          const box = bboxAround(point.lat, point.lng, km + 20);
          return `${OPENSKY}?lamin=${box.lamin.toFixed(3)}&lomin=${box.lomin.toFixed(3)}&lamax=${box.lamax.toFixed(3)}&lomax=${box.lomax.toFixed(3)}`;
        })()
      : OPENSKY;
    const data = await fetchLiveJson<OpenSky>(url, 15000);
    let flights = parseStates(data.states);
    if (local) {
      flights = flights
        .map((flight) => ({ flight, km: kmBetween(point.lat, point.lng, flight.lat, flight.lng) }))
        .filter((row) => row.km <= km)
        .sort((a, b) => a.km - b.km)
        .map((row) => row.flight);
    } else {
      flights = sampleSpread(flights, 500);
    }
    return jsonOk({
      flights,
      source: "opensky",
      radiusKm: local ? km : null,
    });
  } catch (error) {
    return fail(error, "ADS-B failed");
  }
}
