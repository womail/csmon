import { NextRequest } from "next/server";
import { fetchJson, fetchRssXml } from "@/lib/http";
import { coordsForPlace } from "@/lib/geo";
import { asCoords, gate, jsonOk } from "@/lib/guard";
import { weatherSummary, type LocalWeather, type WeatherEvent } from "@/lib/weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NWS = "https://api.weather.gov/alerts/active?status=actual&message_type=alert";
const MET_EIREANN = "https://www.met.ie/warningsxml/rss.xml";
const MET_OFFICE = "https://www.metoffice.gov.uk/public/data/PWSCache/WarningsRSS/Region/UK";

type NwsFeed = {
  features?: {
    id?: string;
    properties?: {
      headline?: string;
      event?: string;
      severity?: string;
      areaDesc?: string;
      sent?: string;
      effective?: string;
      web?: string;
    };
    geometry?: { type?: string; coordinates?: unknown } | null;
  }[];
};

type OpenMeteo = {
  current?: {
    temperature_2m?: number;
    precipitation?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  };
};

function centroid(geometry: { type?: string; coordinates?: unknown } | null | undefined) {
  if (!geometry?.coordinates) return null;
  const pts: number[][] = [];
  function walk(value: unknown) {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      pts.push([Number(value[0]), Number(value[1])]);
      return;
    }
    for (const child of value) walk(child);
  }
  walk(geometry.coordinates);
  if (!pts.length) return null;
  let lng = 0;
  let lat = 0;
  for (const [x, y] of pts) {
    lng += x;
    lat += y;
  }
  return { lat: lat / pts.length, lng: lng / pts.length };
}

function regionFor(lat: number, lng: number) {
  if (lng <= -50) return "us";
  if (lat >= 51 && lat <= 55.7 && lng >= -11 && lng <= -5.2) return "ie";
  if (lat >= 49 && lat <= 61 && lng >= -11 && lng <= 2) return "uk";
  return "other";
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

async function rssWarnings(
  url: string,
  source: "met",
  fallbackPlace: string,
  fallbackPoint: { lat: number; lng: number } | null,
): Promise<WeatherEvent[]> {
  const xml = await fetchRssXml(url, 10000);
  const events: WeatherEvent[] = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];
    const title = decodeXml(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "Weather warning");
    const link = decodeXml(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? url);
    const desc = decodeXml(block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "");
    const when = Date.parse(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "") || Date.now();
    const placeGuess =
      title.match(/\b(Dublin|Cork|Galway|Limerick|Belfast|London|Manchester|Scotland|Wales|Ireland|UK)\b/i)?.[0] ??
      fallbackPlace;
    const point = coordsForPlace(placeGuess) ?? fallbackPoint;
    events.push({
      id: `${source}-${link || title}`,
      title,
      severity: /red|severe|extreme/i.test(`${title} ${desc}`)
        ? "Severe"
        : /amber|orange|moderate/i.test(`${title} ${desc}`)
          ? "Moderate"
          : "Minor",
      place: placeGuess,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
      time: when,
      url: link.startsWith("http") ? link : url,
      source,
      hint: desc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 140) || undefined,
    });
    if (events.length >= 12) break;
  }
  return events;
}

export async function GET(req: NextRequest) {
  const blocked = gate(req, "weather", 30);
  if (blocked) return blocked;
  const point = asCoords(req.nextUrl.searchParams.get("lat"), req.nextUrl.searchParams.get("lng"));
  const lat = point?.lat ?? Number.NaN;
  const lng = point?.lng ?? Number.NaN;
  const place = (req.nextUrl.searchParams.get("place") || "Home").slice(0, 80);
  const events: WeatherEvent[] = [];
  let local: LocalWeather | null = null;
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);
  const region = hasPoint ? regionFor(lat, lng) : "other";
  const homePoint = hasPoint ? { lat, lng } : null;

  if (region === "us" || region === "other") {
    try {
      const data = await fetchJson<NwsFeed>(NWS, 14000);
      for (const feature of data.features ?? []) {
        const point = centroid(feature.geometry);
        const title = feature.properties?.headline || feature.properties?.event || "Weather alert";
        events.push({
          id: String(feature.id ?? title),
          title,
          severity: feature.properties?.severity ?? "Unknown",
          place: feature.properties?.areaDesc?.split(";")[0]?.trim() || "United States",
          lat: point?.lat ?? null,
          lng: point?.lng ?? null,
          time: Date.parse(feature.properties?.effective || feature.properties?.sent || "") || Date.now(),
          url: feature.properties?.web || "https://alerts.weather.gov",
          source: "nws",
          hint: feature.properties?.event,
        });
        if (events.filter((event) => event.source === "nws").length >= 24) break;
      }
    } catch {
      /* NWS is best-effort */
    }
  }

  if (region === "ie" || region === "uk" || region === "other") {
    try {
      events.push(...(await rssWarnings(MET_EIREANN, "met", "Ireland", homePoint)));
    } catch {
      /* Met Éireann is best-effort */
    }
  }
  if (region === "uk" || region === "ie" || region === "other") {
    try {
      events.push(...(await rssWarnings(MET_OFFICE, "met", "UK", homePoint)));
    } catch {
      /* Met Office is best-effort */
    }
  }

  if (hasPoint) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,wind_speed_10m,weather_code`;
      const data = await fetchJson<OpenMeteo>(url, 8000);
      const code = data.current?.weather_code ?? null;
      local = {
        place,
        lat,
        lng,
        temperature: data.current?.temperature_2m ?? null,
        wind: data.current?.wind_speed_10m ?? null,
        precipitation: data.current?.precipitation ?? null,
        code,
        summary: weatherSummary(code),
      };
      events.unshift({
        id: `local-${place}`,
        title: `${place} · ${local.summary}${local.temperature != null ? ` · ${Math.round(local.temperature)}°C` : ""}`,
        severity: (local.precipitation ?? 0) > 0.5 || (code ?? 0) >= 80 ? "Moderate" : "Minor",
        place,
        lat,
        lng,
        time: Date.now(),
        url: `https://open-meteo.com/en/docs#latitude=${lat}&longitude=${lng}`,
        source: "local",
        hint: local.wind != null ? `${Math.round(local.wind)} km/h wind` : undefined,
      });
    } catch {
      /* Open-Meteo is best-effort */
    }
  }

  return jsonOk({ events, local });
}
