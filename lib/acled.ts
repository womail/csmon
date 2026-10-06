/** ACLED conflict event API (server credentials). */

export const ACLED_STORAGE_KEY = "csmon.acled";
export const ACLED_ORIGIN = "https://acleddata.com";
export const ACLED_READ = `${ACLED_ORIGIN}/api/acled/read`;
export const ACLED_TOKEN = `${ACLED_ORIGIN}/oauth/token`;
export const MAX_ACLED_PROFILES = 6;
export const MAX_ACLED_ENABLED = 3;

export type AcledProfile = {
  id: string;
  name: string;
  /** ACLED `country` filter (exact name, e.g. Ukraine, Ireland). Empty = no country filter (global sample). */
  country: string;
  /** Pull events with event_date on or after today − days. */
  days: number;
  limit: number;
  enabled: boolean;
};

export const ACLED_PRESETS: AcledProfile[] = [
  {
    id: "ukraine",
    name: "Ukraine",
    country: "Ukraine",
    days: 14,
    limit: 120,
    enabled: true,
  },
  {
    id: "middle-east",
    name: "Middle East (Israel)",
    country: "Israel",
    days: 14,
    limit: 120,
    enabled: false,
  },
  {
    id: "global-unrest",
    name: "Global unrest sample",
    country: "",
    days: 7,
    limit: 80,
    enabled: false,
  },
];

export const DEFAULT_ACLED_PROFILES: AcledProfile[] = [ACLED_PRESETS[0]];

export function acledSourceKey(id: string) {
  return `acled:${id}`;
}

export function isAcledFeedUrl(url: string | null | undefined) {
  return Boolean(url?.startsWith("acled://"));
}

export function acledFeedUrl(profile: AcledProfile) {
  const params = new URLSearchParams({
    id: profile.id,
    days: String(profile.days),
    limit: String(profile.limit),
  });
  if (profile.country.trim()) params.set("country", profile.country.trim());
  return `acled://read?${params.toString()}`;
}

export function parseAcledFeedUrl(feedUrl: string): { country: string; days: number; limit: number } | null {
  if (!isAcledFeedUrl(feedUrl)) return null;
  try {
    const url = new URL(feedUrl.replace("acled://", "https://acled.local/"));
    return {
      country: url.searchParams.get("country") ?? "",
      days: Math.min(90, Math.max(1, Number(url.searchParams.get("days")) || 14)),
      limit: Math.min(500, Math.max(10, Number(url.searchParams.get("limit")) || 100)),
    };
  } catch {
    return null;
  }
}

export function acledConfigured() {
  return Boolean(process.env.ACLED_USERNAME?.trim() && process.env.ACLED_PASSWORD?.trim());
}

export function normalizeAcledProfiles(input: unknown): AcledProfile[] {
  if (!Array.isArray(input)) return [];
  const taken = new Set<string>();
  const rows: AcledProfile[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const name = String(row.name ?? "").trim().slice(0, 48);
    if (!name) continue;
    let id = String(row.id ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 32);
    if (!id || taken.has(id)) {
      id = `p-${rows.length + 1}`;
      while (taken.has(id)) id = `p-${rows.length + 1}-${taken.size}`;
    }
    taken.add(id);
    rows.push({
      id,
      name,
      country: String(row.country ?? "").trim().slice(0, 64),
      days: Math.min(90, Math.max(1, Math.round(Number(row.days)) || 14)),
      limit: Math.min(500, Math.max(10, Math.round(Number(row.limit)) || 100)),
      enabled: row.enabled === true,
    });
    if (rows.length >= MAX_ACLED_PROFILES) break;
  }
  let enabled = 0;
  for (const row of rows) {
    if (!row.enabled) continue;
    enabled += 1;
    if (enabled > MAX_ACLED_ENABLED) row.enabled = false;
  }
  return rows;
}

export function loadAcledProfiles(): AcledProfile[] {
  if (typeof window === "undefined") return DEFAULT_ACLED_PROFILES;
  try {
    const raw = window.localStorage.getItem(ACLED_STORAGE_KEY);
    if (!raw) return DEFAULT_ACLED_PROFILES;
    const parsed = JSON.parse(raw) as unknown;
    const normalized = normalizeAcledProfiles(parsed);
    return normalized.length ? normalized : DEFAULT_ACLED_PROFILES;
  } catch {
    return DEFAULT_ACLED_PROFILES;
  }
}

export function saveAcledProfiles(profiles: AcledProfile[]) {
  const normalized = normalizeAcledProfiles(profiles);
  window.localStorage.setItem(ACLED_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
