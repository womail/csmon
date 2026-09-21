import { asIcao24, fail, gate, jsonOk } from "@/lib/guard";
import { fetchJson, fetchLiveJson } from "@/lib/http";
import type { AircraftProfile, Flight } from "@/lib/flights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HexDb = {
  icao?: string;
  Registration?: string;
  Manufacturer?: string;
  Type?: string;
  RegisteredOwners?: string;
  OperatorFlagCode?: string;
  IcaoTypeCode?: string;
};

type OpenSky = {
  states?: (string | number | boolean | null)[][] | null;
};

export async function GET(request: Request) {
  const blocked = gate(request, "aircraft", 30);
  if (blocked) return blocked;
  const icao24 = asIcao24(new URL(request.url).searchParams.get("icao24"));
  if (!icao24) return jsonOk({ error: "Missing icao24" }, 400);
  try {
    const [profile, live] = await Promise.all([
      fetchJson<HexDb>(`https://hexdb.net/api/v1/aircraft/${icao24}`, 8000).catch(() => null),
      fetchLiveJson<OpenSky>(`https://opensky-network.org/api/states/all?icao24=${icao24}`, 10000).catch(
        () => null,
      ),
    ]);
    const row = live?.states?.[0];
    const flight: Flight | null = row
      ? {
          icao24,
          callsign: String(row[1] ?? "").trim(),
          country: String(row[2] ?? ""),
          lat: Number(row[6]),
          lng: Number(row[5]),
          altitude: typeof row[7] === "number" ? row[7] : null,
          speed: typeof row[9] === "number" ? row[9] : null,
          heading: typeof row[10] === "number" ? row[10] : null,
          onGround: Boolean(row[8]),
        }
      : null;
    const meta: AircraftProfile = {
      icao24,
      registration: profile?.Registration ?? null,
      type: profile?.Type ?? null,
      manufacturer: profile?.Manufacturer ?? null,
      operator: profile?.RegisteredOwners ?? null,
      owner: profile?.RegisteredOwners ?? null,
      icaoType: profile?.IcaoTypeCode ?? null,
    };
    return jsonOk({ flight, profile: meta });
  } catch (error) {
    return fail(error, "Aircraft lookup failed");
  }
}
