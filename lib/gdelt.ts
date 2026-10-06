/** GDELT DOC 2.0 article search. Shared by the tuner and the server. */

export const GDELT_STORAGE_KEY = "csmon.gdelt";
export const GDELT_DOC_ORIGIN = "https://api.gdeltproject.org/api/v2/doc/doc";
export const MAX_GDELT_QUERIES = 8;
export const MAX_GDELT_ENABLED = 4;
export const GDELT_RECORD_MIN = 10;
export const GDELT_RECORD_MAX = 75;

export const GDELT_TIMESPANS = ["1h", "12h", "1d", "3d", "1w", "1m"] as const;
export type GdeltTimespan = (typeof GDELT_TIMESPANS)[number];

export type GdeltQuery = {
  id: string;
  name: string;
  /** GDELT DOC query language, without mode/format/timespan. */
  query: string;
  timespan: GdeltTimespan;
  maxRecords: number;
  enabled: boolean;
  /** Append sourcelang:english when the query does not already set a language. */
  englishOnly: boolean;
};

/** GDELT DOC rejects many full country names; FIPS codes (UK, US, EI) and keywords work. */
const LEGACY_GDELT_QUERY: Record<string, string> = {
  "sourcecountry:ireland": "Ireland",
  "sourcecountry:unitedkingdom": "sourcecountry:UK",
  "sourcecountry:unitedstates": "sourcecountry:US",
  "theme:natural_disaster": "(earthquake OR flood OR wildfire OR hurricane OR tsunami)",
  "(theme:military or theme:armedconflict)": "(airstrike OR invasion OR war OR military OR ukraine)",
  "(theme:protest or theme:civil_unrest)": "(protest OR riot OR coup OR unrest OR demonstration)",
};

export function canonicalGdeltQuery(raw: string): string {
  const query = raw.trim().replace(/\s+/g, " ");
  const lower = query.toLowerCase();
  if (LEGACY_GDELT_QUERY[lower]) return LEGACY_GDELT_QUERY[lower];
  const lang = query.match(/\bsourcelang:(\S+)/i);
  if (lang) {
    const base = query.replace(/\bsourcelang:\S+/gi, "").trim().replace(/\s+/g, " ");
    const mapped = LEGACY_GDELT_QUERY[base.toLowerCase()];
    if (mapped) return `${mapped} sourcelang:${lang[1]}`;
  }
  return query;
}

export const GDELT_PRESETS: GdeltQuery[] = [
  {
    id: "ireland",
    name: "Ireland",
    query: "Ireland",
    timespan: "1w",
    maxRecords: 40,
    enabled: false,
    englishOnly: false,
  },
  {
    id: "uk",
    name: "UK",
    query: "sourcecountry:UK",
    timespan: "1w",
    maxRecords: 40,
    enabled: false,
    englishOnly: true,
  },
  {
    id: "us",
    name: "US",
    query: "sourcecountry:US",
    timespan: "1w",
    maxRecords: 40,
    enabled: false,
    englishOnly: true,
  },
  {
    id: "war",
    name: "War",
    query: "(airstrike OR invasion OR war OR military OR ukraine OR missile)",
    timespan: "1w",
    maxRecords: 50,
    enabled: true,
    englishOnly: true,
  },
  {
    id: "unrest",
    name: "Unrest",
    query: "(protest OR demonstration OR riot OR coup OR strike OR unrest OR civil disorder)",
    timespan: "1w",
    maxRecords: 50,
    enabled: true,
    englishOnly: false,
  },
  {
    id: "disaster",
    name: "Disasters",
    query: "(earthquake OR flood OR wildfire OR hurricane OR tsunami)",
    timespan: "1w",
    maxRecords: 40,
    enabled: false,
    englishOnly: true,
  },
];

/** First-time defaults: global conflict desks, not Ireland-only. */
export const DEFAULT_GDELT_QUERIES: GdeltQuery[] = GDELT_PRESETS.map((preset) => ({ ...preset }));

export const GDELT_PACKS: { id: string; label: string; presetIds: string[] }[] = [
  { id: "conflict", label: "Conflict & unrest", presetIds: ["war", "unrest"] },
  { id: "regions", label: "Ireland & UK", presetIds: ["ireland", "uk"] },
  { id: "americas", label: "US focus", presetIds: ["us", "war"] },
  { id: "hazards", label: "Disasters", presetIds: ["disaster"] },
];

export function gdeltSourceKey(id: string) {
  return `gdelt:${id}`;
}

export function isGdeltDocUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "api.gdeltproject.org" && parsed.pathname === "/api/v2/doc/doc";
  } catch {
    return false;
  }
}

export function sanitizeGdeltQuery(raw: string): string | null {
  const query = raw.trim().replace(/\s+/g, " ");
  if (query.length < 2 || query.length > 300) return null;
  if (!/^[A-Za-z0-9("' ][A-Za-z0-9 "'():_.,+\-<>*]*$/.test(query)) return null;
  if (!/[A-Za-z]/.test(query)) return null;
  return query;
}

/** Append English filter without wrapping — GDELT rejects `(single-clause) sourcelang:…`. */
export function gdeltSearchText(query: GdeltQuery) {
  const base = canonicalGdeltQuery(query.query);
  if (!query.englishOnly || /\bsourcelang:/i.test(base)) return base;
  return `${base} sourcelang:english`;
}

/** Fix legacy URLs that wrapped a single clause before `sourcelang:english`. */
export function repairGdeltDocQueryParam(query: string): string {
  let trimmed = canonicalGdeltQuery(query);
  const wrapped = trimmed.match(/^\(([^()]+)\)\s+(sourcelang:.+)$/i);
  if (wrapped) trimmed = `${wrapped[1].trim()} ${wrapped[2].trim()}`;
  return trimmed;
}

export function repairGdeltFeedUrl(feedUrl: string): string {
  if (!isGdeltDocUrl(feedUrl)) return feedUrl;
  try {
    const url = new URL(feedUrl);
    const query = url.searchParams.get("query");
    if (!query) return feedUrl;
    const repaired = repairGdeltDocQueryParam(query);
    let changed = repaired !== query;
    if (changed) url.searchParams.set("query", repaired);
    const span = (url.searchParams.get("timespan") || "").toLowerCase();
    if (changed && (span === "1h" || span === "12h" || span === "1d" || span === "3d")) {
      url.searchParams.set("timespan", "1w");
    }
    if ((url.searchParams.get("mode") || "").toLowerCase() === "artlist") {
      url.searchParams.set("mode", "ArtList");
      changed = true;
    }
    if ((url.searchParams.get("sort") || "").toLowerCase() === "datedesc") {
      url.searchParams.set("sort", "DateDesc");
      changed = true;
    }
    return changed ? url.toString() : feedUrl;
  } catch {
    return feedUrl;
  }
}

export function gdeltDocUrl(query: GdeltQuery) {
  const params = new URLSearchParams({
    query: gdeltSearchText(query),
    mode: "ArtList",
    format: "json",
    maxrecords: String(query.maxRecords),
    timespan: query.timespan,
    sort: "DateDesc",
  });
  return `${GDELT_DOC_ORIGIN}?${params.toString()}`;
}

function clampRecords(value: unknown) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 40;
  return Math.min(GDELT_RECORD_MAX, Math.max(GDELT_RECORD_MIN, n));
}

function slugId(name: string, taken: Set<string>) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "query";
  let id = base;
  let n = 2;
  while (taken.has(id)) {
    id = `${base}-${n++}`.slice(0, 32);
  }
  return id;
}

export function normalizeGdeltQueries(input: unknown): GdeltQuery[] {
  if (!Array.isArray(input)) return [];
  const taken = new Set<string>();
  const queries: GdeltQuery[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const name = String(row.name ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    const query = sanitizeGdeltQuery(canonicalGdeltQuery(String(row.query ?? "")));
    if (!name || !query) continue;
    let id = String(row.id ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 32);
    if (!id || taken.has(id)) id = slugId(name, taken);
    taken.add(id);
    const timespan = GDELT_TIMESPANS.includes(row.timespan as GdeltTimespan)
      ? (row.timespan as GdeltTimespan)
      : "1d";
    queries.push({
      id,
      name,
      query,
      timespan,
      maxRecords: clampRecords(row.maxRecords),
      enabled: row.enabled === true,
      englishOnly: row.englishOnly === true,
    });
    if (queries.length >= MAX_GDELT_QUERIES) break;
  }
  let enabled = 0;
  for (const query of queries) {
    if (!query.enabled) continue;
    enabled += 1;
    if (enabled > MAX_GDELT_ENABLED) query.enabled = false;
  }
  return queries;
}

function asDraft(raw: unknown): GdeltQuery | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const name = String(row.name ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  const query = String(row.query ?? "").slice(0, 300);
  const id = String(row.id ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32);
  if (!name || !id) return null;
  const timespan = GDELT_TIMESPANS.includes(row.timespan as GdeltTimespan)
    ? (row.timespan as GdeltTimespan)
    : "1d";
  const maxRecords = Math.round(Number(row.maxRecords));
  return {
    id,
    name,
    query,
    timespan,
    maxRecords: Number.isFinite(maxRecords) ? maxRecords : 40,
    enabled: row.enabled === true,
    englishOnly: row.englishOnly === true,
  };
}

/** Editor draft. Invalid searches stay visible until Load, which asks the server to drop them. */
export function loadGdeltQueries(): GdeltQuery[] {
  if (typeof window === "undefined") return DEFAULT_GDELT_QUERIES;
  try {
    const raw = window.localStorage.getItem(GDELT_STORAGE_KEY);
    if (!raw) return DEFAULT_GDELT_QUERIES;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_GDELT_QUERIES;
    const queries = parsed.map(asDraft).filter((query): query is GdeltQuery => query !== null);
    return queries.slice(0, MAX_GDELT_QUERIES).length ? queries.slice(0, MAX_GDELT_QUERIES) : DEFAULT_GDELT_QUERIES;
  } catch {
    return DEFAULT_GDELT_QUERIES;
  }
}

export function saveGdeltQueries(queries: GdeltQuery[]) {
  const next = queries
    .map(asDraft)
    .filter((query): query is GdeltQuery => query !== null)
    .slice(0, MAX_GDELT_QUERIES);
  window.localStorage.setItem(GDELT_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function mergeGdeltFromSubredditSuggestions(
  existing: GdeltQuery[],
  suggestions: { id: string; name: string; query: string }[],
): GdeltQuery[] {
  const taken = new Set(existing.map((query) => query.id));
  const merged = [...existing];
  let enabled = merged.filter((query) => query.enabled).length;
  for (const row of suggestions) {
    if (merged.length >= MAX_GDELT_QUERIES) break;
    let id = row.id.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32) || "query";
    if (taken.has(id)) {
      let n = 2;
      while (taken.has(`${id}-${n}`) && n < 50) n += 1;
      id = `${id}-${n}`.slice(0, 32);
    }
    taken.add(id);
    const enableNext = enabled < MAX_GDELT_ENABLED;
    if (enableNext) enabled += 1;
    merged.push({
      id,
      name: row.name.slice(0, 40),
      query: row.query.slice(0, 300),
      timespan: "1w",
      maxRecords: 40,
      enabled: enableNext,
      englishOnly: true,
    });
  }
  return merged.slice(0, MAX_GDELT_QUERIES);
}

export function newGdeltQuery(existing: GdeltQuery[]): GdeltQuery {
  const taken = new Set(existing.map((query) => query.id));
  const id = slugId("query", taken);
  return {
    id,
    name: "Query",
    query: "Ireland",
    timespan: "1d",
    maxRecords: 40,
    enabled: existing.filter((query) => query.enabled).length < MAX_GDELT_ENABLED,
    englishOnly: true,
  };
}
