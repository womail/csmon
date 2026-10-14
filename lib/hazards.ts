import { kmBetween } from "./geo";

/** Open natural event from NASA EONET (storms, wildfires, volcanoes, floods…). */
export type NaturalEvent = {
  id: string;
  title: string;
  category: string;
  lat: number | null;
  lng: number | null;
  time: number;
  url: string;
  magnitude: string | null;
};

/** Country-level internet disruption from IODA (Georgia Tech). */
export type OutageRow = {
  code: string;
  country: string;
  score: number;
  events: number;
  signals: string[];
  url: string;
};

export const EONET_EVENTS =
  "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=10&limit=80";
export const IODA_SUMMARY = "https://api.ioda.inetintel.cc.gatech.edu/v2/outages/summary";

const SKIP_EONET = new Set(["seaLakeIce", "snow", "waterColor", "manmade"]);

type EonetGeometry = { date?: string; type?: string; coordinates?: unknown; magnitudeValue?: number; magnitudeUnit?: string };

function eonetPoint(geometry: EonetGeometry | undefined) {
  if (!geometry?.coordinates) return null;
  if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates as number[];
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
  const ring = (geometry.coordinates as number[][][])?.[0];
  if (!Array.isArray(ring) || !ring.length) return null;
  const lat = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
  const lng = ring.reduce((sum, p) => sum + p[0], 0) / ring.length;
  return { lat, lng };
}

export function parseEonet(body: unknown): NaturalEvent[] {
  const events = (body as { events?: unknown })?.events;
  if (!Array.isArray(events)) return [];
  const out: NaturalEvent[] = [];
  for (const raw of events as Record<string, unknown>[]) {
    const categories = (raw.categories as { id?: string; title?: string }[] | undefined) ?? [];
    const category = categories[0];
    if (!category?.id || SKIP_EONET.has(category.id)) continue;
    const geometry = ((raw.geometry as EonetGeometry[] | undefined) ?? []).at(-1);
    const point = eonetPoint(geometry);
    const sources = (raw.sources as { url?: string }[] | undefined) ?? [];
    out.push({
      id: String(raw.id ?? raw.title),
      title: String(raw.title ?? "Natural event"),
      category: category.title ?? category.id,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
      time: Date.parse(geometry?.date ?? "") || Date.now(),
      url: sources[0]?.url || String(raw.link ?? "https://eonet.gsfc.nasa.gov"),
      magnitude:
        geometry?.magnitudeValue != null ? `${geometry.magnitudeValue} ${geometry.magnitudeUnit ?? ""}`.trim() : null,
    });
  }
  return out.sort((a, b) => b.time - a.time);
}

const IODA_SIGNAL: Record<string, string> = {
  bgp: "BGP routes",
  "ping-slash24": "active probing",
  gtr: "Google traffic",
  "merit-nt": "darknet telescope",
};

export function parseIodaSummary(body: unknown, limit = 10): OutageRow[] {
  const data = (body as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  const out: OutageRow[] = [];
  for (const row of data as Record<string, unknown>[]) {
    const entity = row.entity as { code?: string; name?: string } | undefined;
    const scores = (row.scores as Record<string, number> | undefined) ?? {};
    if (!entity?.code || !entity.name) continue;
    const signals = [
      ...new Set(
        Object.keys(scores)
          .filter((key) => key !== "overall")
          .map((key) => IODA_SIGNAL[key.split(".")[0]] ?? key.split(".")[0]),
      ),
    ];
    out.push({
      code: entity.code,
      country: entity.name,
      score: Number(scores.overall ?? 0),
      events: Number(row.event_cnt ?? 0),
      signals,
      url: `https://ioda.inetintel.cc.gatech.edu/country/${entity.code}`,
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** MeteoAlarm national feed slugs, located by capital so a home city picks its own country. */
const METEOALARM_COUNTRIES: { slug: string; label: string; lat: number; lng: number }[] = [
  { slug: "ireland", label: "Ireland", lat: 53.35, lng: -6.26 },
  { slug: "united-kingdom", label: "UK", lat: 51.51, lng: -0.13 },
  { slug: "france", label: "France", lat: 48.86, lng: 2.35 },
  { slug: "germany", label: "Germany", lat: 52.52, lng: 13.4 },
  { slug: "netherlands", label: "Netherlands", lat: 52.37, lng: 4.9 },
  { slug: "belgium", label: "Belgium", lat: 50.85, lng: 4.35 },
  { slug: "spain", label: "Spain", lat: 40.42, lng: -3.7 },
  { slug: "portugal", label: "Portugal", lat: 38.72, lng: -9.14 },
  { slug: "italy", label: "Italy", lat: 41.9, lng: 12.5 },
  { slug: "austria", label: "Austria", lat: 48.21, lng: 16.37 },
  { slug: "switzerland", label: "Switzerland", lat: 46.95, lng: 7.45 },
  { slug: "denmark", label: "Denmark", lat: 55.68, lng: 12.57 },
  { slug: "norway", label: "Norway", lat: 59.91, lng: 10.75 },
  { slug: "sweden", label: "Sweden", lat: 59.33, lng: 18.07 },
  { slug: "finland", label: "Finland", lat: 60.17, lng: 24.94 },
  { slug: "poland", label: "Poland", lat: 52.23, lng: 21.01 },
];

export function meteoalarmCountryFor(lat: number, lng: number) {
  let best: (typeof METEOALARM_COUNTRIES)[number] | null = null;
  let bestKm = Infinity;
  for (const row of METEOALARM_COUNTRIES) {
    const km = kmBetween(lat, lng, row.lat, row.lng);
    if (km < bestKm) {
      best = row;
      bestKm = km;
    }
  }
  return best && bestKm <= 700
    ? { ...best, url: `https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-${best.slug}` }
    : null;
}

export type MeteoalarmWarning = {
  id: string;
  event: string;
  area: string;
  severity: string;
  onset: number | null;
  expires: number | null;
  url: string;
};

function tag(block: string, name: string) {
  return block.match(new RegExp(`<cap:${name}>([\\s\\S]*?)</cap:${name}>`, "i"))?.[1]?.trim() ?? "";
}

const SEVERITY_RANK: Record<string, number> = { Extreme: 3, Severe: 2, Moderate: 1, Minor: 0 };

/** CAP Atom entries that have not expired, worst first, one per event + area. */
export function parseMeteoalarmAtom(xml: string, now = Date.now()): MeteoalarmWarning[] {
  const seen = new Set<string>();
  const out: MeteoalarmWarning[] = [];
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)) {
    const block = match[1];
    const event = tag(block, "event");
    const area = tag(block, "areaDesc");
    if (!event || !area) continue;
    const expires = Date.parse(tag(block, "expires")) || null;
    if (expires && expires < now) continue;
    const key = `${event}|${area}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: tag(block, "identifier") || key,
      event,
      area,
      severity: tag(block, "severity") || "Unknown",
      onset: Date.parse(tag(block, "onset")) || null,
      expires,
      url: block.match(/<link[^>]*href="([^"]+)"/i)?.[1]?.replace(/&amp;/g, "&") ?? "https://meteoalarm.org",
    });
  }
  return out.sort((a, b) => (SEVERITY_RANK[b.severity] ?? -1) - (SEVERITY_RANK[a.severity] ?? -1));
}
