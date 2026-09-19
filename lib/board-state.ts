import type { PatchRisk } from "./kev";
import type { Desk, OriginReason, TimeRange } from "./types";

export type BoardFilters = {
  desk: Desk;
  q: string;
  topic: string | null;
  place: string | null;
  range: TimeRange;
  cross: boolean;
  stack: string;
  risk: PatchRisk | "all";
  vendor: string | null;
  ransomware: boolean;
  layer: number | null;
  origin: OriginReason | null;
};

export const DESKS: { id: Desk; label: string; hint: string }[] = [
  { id: "brief", label: "Brief", hint: "Clustered stories" },
  { id: "scan", label: "Scan", hint: "Raw items" },
  { id: "pulse", label: "Pulse", hint: "Volume and mix" },
  { id: "advisories", label: "Advisories", hint: "Cyber desk" },
  { id: "patch", label: "Patch", hint: "CISA KEV" },
  { id: "sources", label: "Sources", hint: "Layers and cache" },
];

const DESK_IDS = new Set(DESKS.map((d) => d.id));
const RANGES = new Set<TimeRange>(["1h", "6h", "24h", "7d", "all"]);
const RISKS = new Set(["all", "p0", "p1", "p2"]);
const ORIGINS = new Set<OriginReason>(["self", "follow", "mention", "link", "intel", "explore"]);

function one(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function defaultBoardFilters(stack = ""): BoardFilters {
  return {
    desk: "brief",
    q: "",
    topic: null,
    place: null,
    range: "24h",
    cross: false,
    stack,
    risk: "p0",
    vendor: null,
    ransomware: false,
    layer: null,
    origin: null,
  };
}

export function parseBoardFilters(
  params: Record<string, string | string[] | undefined>,
  fallbackStack = "",
): BoardFilters {
  const deskRaw = one(params.desk) as Desk;
  const rangeRaw = one(params.range) as TimeRange;
  const riskRaw = one(params.risk);
  const originRaw = one(params.origin) as OriginReason;
  return {
    desk: DESK_IDS.has(deskRaw) ? deskRaw : "brief",
    q: one(params.q),
    topic: one(params.topic) || null,
    place: one(params.place) || null,
    range: RANGES.has(rangeRaw) ? rangeRaw : "24h",
    cross: one(params.cross) === "1",
    stack: one(params.stack) || fallbackStack,
    risk: RISKS.has(riskRaw) ? (riskRaw as PatchRisk | "all") : "p0",
    vendor: one(params.vendor) || null,
    ransomware: one(params.ransomware) === "1",
    layer: one(params.layer) ? Number(one(params.layer)) || null : null,
    origin: ORIGINS.has(originRaw) ? originRaw : null,
  };
}

export function boardQueryString(filters: BoardFilters) {
  const p = new URLSearchParams();
  if (filters.desk !== "brief") p.set("desk", filters.desk);
  if (filters.q) p.set("q", filters.q);
  if (filters.topic) p.set("topic", filters.topic);
  if (filters.place) p.set("place", filters.place);
  if (filters.range !== "24h") p.set("range", filters.range);
  if (filters.cross) p.set("cross", "1");
  if (filters.stack) p.set("stack", filters.stack);
  if (filters.desk === "patch" && filters.risk !== "p0") p.set("risk", filters.risk);
  if (filters.vendor) p.set("vendor", filters.vendor);
  if (filters.ransomware) p.set("ransomware", "1");
  if (filters.layer) p.set("layer", String(filters.layer));
  if (filters.origin) p.set("origin", filters.origin);
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

export function syncBoardUrl(filters: BoardFilters) {
  if (typeof window === "undefined") return;
  const next = `${window.location.pathname}${boardQueryString(filters)}`;
  if (next !== `${window.location.pathname}${window.location.search}`) {
    window.history.replaceState(null, "", next);
  }
}
