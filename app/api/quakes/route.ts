import { NextResponse } from "next/server";
import { fetchJson } from "@/lib/http";
import type { QuakeEvent } from "@/lib/quakes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USGS =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson";

type UsgsFeed = {
  features?: {
    id?: string;
    properties?: { mag?: number; place?: string; time?: number; url?: string; title?: string };
    geometry?: { coordinates?: number[] };
  }[];
};

export async function GET() {
  try {
    const data = await fetchJson<UsgsFeed>(USGS, 12000);
    const quakes: QuakeEvent[] = (data.features ?? [])
      .map((feature) => {
        const [lng, lat] = feature.geometry?.coordinates ?? [];
        if (typeof lat !== "number" || typeof lng !== "number") return null;
        return {
          id: String(feature.id ?? `${lat},${lng}`),
          title: feature.properties?.title ?? feature.properties?.place ?? "Earthquake",
          place: feature.properties?.place ?? "Unknown",
          mag: Number(feature.properties?.mag ?? 0),
          lat,
          lng,
          time: Number(feature.properties?.time ?? Date.now()),
          url: feature.properties?.url ?? "https://earthquake.usgs.gov",
        } satisfies QuakeEvent;
      })
      .filter((row): row is QuakeEvent => row != null)
      .sort((a, b) => b.mag - a.mag)
      .slice(0, 40);
    return NextResponse.json({ quakes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "USGS failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
