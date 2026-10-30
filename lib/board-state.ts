import { isKnownTopic } from "./classify";
import type { PatchRisk } from "./kev";
import { isKnownPlace, resolvePlace } from "./places";
import {
  activeQueryRules,
  emptyQuery,
  encodeQueryTree,
  hasQuery,
  parseQueryTree,
  type QueryTree,
} from "./query-builder";
import { retainMapCamera } from "./map-camera";
import { isDeskId, type Desk, type OriginReason, type Platform, type TimeRange } from "./types";
import { isSourceType, type SourceType } from "./source-types";
import { isFamilyId, type FamilyId } from "./topic-families";

const CVE_RE = /^CVE-\d{4}-\d{4,}$/i;

/** Comma list that keeps case and quoted values (`not=topic:sports,place:Ireland`). */
function parseTokenList(raw: string, max = 12): string[] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.includes(":") && value.length < 120)
    .slice(0, max);
}

export type BoardFilters = {
  desk: Desk;
  q: string;
  topic: string | null;
  /** Extra topics (any match) for custom desks. */
  topics: string[];
  place: string | null;
  /** Tag chips (any match) for custom desks. */
  tags: string[];
  /** Extra terms inside the current desk. Any match: NFL and Soccer both show. */
  nest: string[];
  range: TimeRange;
  cross: boolean;
  stack: string;
  risk: PatchRisk | "all";
  vendor: string | null;
  ransomware: boolean;
  layer: number | null;
  origin: OriginReason | null;
  platform: Platform | null;
  person: string | null;
  /** Organisation from the gazetteer (`lib/gazetteer/orgs.ts`), e.g. APT28 or NATO. */
  org: string | null;
  /** Source types (any match), e.g. cert, vendor. */
  stype: SourceType[];
  /** One source category (OPML folder or pack label). */
  cat: string | null;
  /** Topic families (any match); `general` = no topic. */
  fam: FamilyId[];
  /** Negated facet tokens such as `topic:sports` or `source:12`. */
  not: string[];
  /** CVE ids (any match). */
  cve: string[];
  rising: boolean;
  qb: QueryTree;
  /** Deep-link to open a specific item card / reader. */
  focusItem: number | null;
  /** Entity dossier pane, `kind:value` (`org:APT28`, `place:Ireland`). */
  dossier: string | null;
};

function parseListParam(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

export const DESKS: { id: Desk; label: string; hint: string }[] = [
  { id: "home", label: "Home", hint: "Situation dashboard" },
  { id: "brief", label: "Brief", hint: "Clustered stories" },
  { id: "scan", label: "Scan", hint: "Raw items" },
  { id: "pulse", label: "Pulse", hint: "What's rising" },
  { id: "weather", label: "Weather", hint: "Storms and warnings" },
  { id: "people", label: "People", hint: "Authors and voices" },
  { id: "documents", label: "Documents", hint: "Reports and PDFs" },
  { id: "reports", label: "Reports", hint: "Briefings you compile" },
  { id: "flights", label: "Flights", hint: "Live ADS-B" },
  { id: "advisories", label: "Advisories", hint: "Cyber desk" },
  { id: "patch", label: "Patch", hint: "CISA KEV" },
  { id: "feeds", label: "Feeds", hint: "RSS by category" },
  { id: "sources", label: "Sources", hint: "Layers and cache" },
];

const RANGES = new Set<TimeRange>(["1h", "6h", "24h", "7d", "all"]);
const RISKS = new Set(["all", "p0", "p1", "p2"]);
const ORIGINS = new Set<OriginReason>(["self", "follow", "mention", "link", "intel", "explore", "reddit", "gdelt", "acled"]);
const PLATFORMS = new Set<Platform>(["rss", "bluesky", "web"]);

function one(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function defaultBoardFilters(stack = ""): BoardFilters {
  return {
    desk: "home",
    q: "",
    topic: null,
    topics: [],
    place: null,
    tags: [],
    nest: [],
    range: "24h",
    cross: false,
    stack,
    risk: "p0",
    vendor: null,
    ransomware: false,
    layer: null,
    origin: null,
    platform: null,
    person: null,
    org: null,
    stype: [],
    cat: null,
    fam: [],
    not: [],
    cve: [],
    rising: false,
    qb: emptyQuery(),
    focusItem: null,
    dossier: null,
  };
}

export function normalizeBoardFilters(filters: BoardFilters): BoardFilters {
  const topic = filters.topic?.trim() || null;
  let place = filters.place?.trim() || null;
  let nextTopic = topic;
  if (topic && isKnownPlace(topic) && !isKnownTopic(topic)) {
    if (!place) place = resolvePlace(topic);
    nextTopic = null;
  }
  return {
    ...filters,
    q: filters.q.trim(),
    topic: nextTopic,
    topics: Array.isArray(filters.topics) ? filters.topics.map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8) : [],
    tags: Array.isArray(filters.tags) ? filters.tags.map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8) : [],
    nest: Array.isArray(filters.nest)
      ? filters.nest.map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 12)
      : [],
    place: place ? resolvePlace(place) : null,
    platform: filters.platform && PLATFORMS.has(filters.platform) ? filters.platform : null,
    org: filters.org?.trim() || null,
    stype: [...new Set((filters.stype ?? []).filter(isSourceType))],
    cat: filters.cat?.trim() || null,
    fam: [...new Set((filters.fam ?? []).filter(isFamilyId))],
    not: [...new Set((filters.not ?? []).map((t) => t.trim()).filter((t) => t.includes(":")))].slice(0, 12),
    cve: [...new Set((filters.cve ?? []).map((c) => c.trim().toUpperCase()).filter((c) => CVE_RE.test(c)))].slice(0, 8),
    dossier: filters.dossier && /^[a-z]+:.+/.test(filters.dossier) ? filters.dossier.slice(0, 120) : null,
    qb: { rules: activeQueryRules(filters.qb).slice(0, 8) },
    focusItem:
      typeof filters.focusItem === "number" && filters.focusItem > 0
        ? Math.round(filters.focusItem)
        : null,
  };
}

export function parseBoardFilters(
  params: Record<string, string | string[] | undefined>,
  fallbackStack = "",
): BoardFilters {
  const deskRaw = one(params.desk);
  const rangeRaw = one(params.range) as TimeRange;
  const riskRaw = one(params.risk);
  const originRaw = one(params.origin) as OriginReason;
  const platformRaw = one(params.platform) as Platform;
  return normalizeBoardFilters({
    desk: isDeskId(deskRaw) ? deskRaw : "home",
    q: one(params.q),
    topic: one(params.topic) || null,
    topics: parseListParam(one(params.topics)),
    place: one(params.place) || null,
    tags: parseListParam(one(params.tags)),
    nest: parseListParam(one(params.nest)),
    range: RANGES.has(rangeRaw) ? rangeRaw : "24h",
    cross: one(params.cross) === "1",
    stack: one(params.stack) || fallbackStack,
    risk: RISKS.has(riskRaw) ? (riskRaw as PatchRisk | "all") : "p0",
    vendor: one(params.vendor) || null,
    ransomware: one(params.ransomware) === "1",
    layer: one(params.layer) ? Number(one(params.layer)) || null : null,
    origin: ORIGINS.has(originRaw) ? originRaw : null,
    platform: PLATFORMS.has(platformRaw) ? platformRaw : null,
    person: one(params.person) || null,
    org: one(params.org) || null,
    stype: parseListParam(one(params.stype)) as SourceType[],
    cat: one(params.cat) || null,
    fam: parseListParam(one(params.fam)) as FamilyId[],
    not: parseTokenList(one(params.not)),
    cve: one(params.cve).split(",").map((c) => c.trim()).filter(Boolean),
    dossier: one(params.dossier) || null,
    rising: one(params.rising) === "1",
    qb: parseQueryTree(one(params.qb)),
    focusItem: (() => {
      const n = Math.round(Number(one(params.item)));
      return Number.isFinite(n) && n > 0 ? n : null;
    })(),
  });
}

export function boardQueryString(filters: BoardFilters) {
  const p = new URLSearchParams();
  if (filters.desk !== "home") p.set("desk", filters.desk);
  if (filters.q) p.set("q", filters.q);
  if (filters.topic) p.set("topic", filters.topic);
  if (filters.topics.length) p.set("topics", filters.topics.join(","));
  if (filters.place) p.set("place", filters.place);
  if (filters.tags.length) p.set("tags", filters.tags.join(","));
  if (filters.nest.length) p.set("nest", filters.nest.join(","));
  if (filters.range !== "24h") p.set("range", filters.range);
  if (filters.cross) p.set("cross", "1");
  if (filters.stack) p.set("stack", filters.stack);
  if (filters.desk === "patch" && filters.risk !== "p0") p.set("risk", filters.risk);
  if (filters.vendor) p.set("vendor", filters.vendor);
  if (filters.ransomware) p.set("ransomware", "1");
  if (filters.layer) p.set("layer", String(filters.layer));
  if (filters.origin) p.set("origin", filters.origin);
  if (filters.platform) p.set("platform", filters.platform);
  if (filters.person) p.set("person", filters.person);
  if (filters.org) p.set("org", filters.org);
  if (filters.stype.length) p.set("stype", filters.stype.join(","));
  if (filters.cat) p.set("cat", filters.cat);
  if (filters.fam.length) p.set("fam", filters.fam.join(","));
  if (filters.not.length) p.set("not", filters.not.join(","));
  if (filters.cve.length) p.set("cve", filters.cve.join(","));
  if (filters.dossier) p.set("dossier", filters.dossier);
  if (filters.rising) p.set("rising", "1");
  if (filters.focusItem) p.set("item", String(filters.focusItem));
  if (hasQuery(filters.qb)) p.set("qb", encodeQueryTree(filters.qb));
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

export function syncBoardUrl(filters: BoardFilters) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(boardQueryString(filters));
  retainMapCamera(params);
  const qs = params.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  if (next !== `${window.location.pathname}${window.location.search}`) {
    window.history.replaceState(null, "", next);
  }
}
