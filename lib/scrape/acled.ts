import "server-only";

import { classifyItem } from "../classify";
import { acledConfigured, parseAcledFeedUrl } from "../acled";
import { cacheGet, cacheSet, TTL } from "../cache";
import { getDb } from "../db";
import { fetchOutbound, readLimited } from "../safe-url";
import { UA } from "../http";
import type { ScrapedItem } from "../types";
import {
  acledDebugLog,
  parseAcledReadError,
  runAcledProbe,
  storeAcledLastError,
} from "./acled-probe";

const TOKEN_KEY = "meta:acled:token";
const TOKEN_EXP_KEY = "meta:acled:token_exp";
const REFRESH_KEY = "meta:acled:refresh_token";

type AcledToken = { access_token: string; expires_in?: number; refresh_token?: string };

type AcledRow = {
  event_id?: string;
  event_date?: string;
  event_type?: string;
  sub_event_type?: string;
  country?: string;
  admin1?: string;
  location?: string;
  latitude?: string;
  longitude?: string;
  fatalities?: string;
  notes?: string;
  source?: string;
};

function metaGet(key: string) {
  const row = getDb()
    .prepare("SELECT body FROM fetch_cache WHERE cache_key = ? AND expires_at > ?")
    .get(key, Date.now()) as
    | { body: string }
    | undefined;
  return row?.body ?? "";
}

function metaSet(key: string, body: string, ttlMs: number) {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO fetch_cache (cache_key, kind, body, fetched_at, expires_at)
       VALUES (?, 'live', ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at, expires_at = excluded.expires_at`,
    )
    .run(key, body, now, now + ttlMs);
}

function storeOAuthTokens(json: AcledToken) {
  if (!json.access_token) throw new Error("ACLED token response missing access_token");
  const ttl = Math.min(86_400, Math.max(300, (json.expires_in ?? 3600) - 120)) * 1000;
  metaSet(TOKEN_KEY, json.access_token, ttl);
  metaSet(TOKEN_EXP_KEY, String(Date.now() + ttl), ttl);
  if (json.refresh_token) {
    metaSet(REFRESH_KEY, json.refresh_token, 14 * 24 * 60 * 60 * 1000);
  }
  acledDebugLog("OAuth token stored", { expiresIn: json.expires_in, hasRefresh: Boolean(json.refresh_token) });
  return json.access_token;
}

async function acledOAuthPassword(): Promise<string> {
  const username = process.env.ACLED_USERNAME?.trim();
  const password = process.env.ACLED_PASSWORD?.trim();
  if (!username || !password) {
    throw new Error("ACLED credentials missing. Set ACLED_USERNAME and ACLED_PASSWORD on the server.");
  }
  if (!username.includes("@")) {
    console.warn("[acled] ACLED_USERNAME does not look like an email — ACLED expects your myACLED login email.");
  }

  const body = new URLSearchParams({
    username,
    password,
    grant_type: "password",
    client_id: "acled",
    scope: "authenticated",
  });

  acledDebugLog("OAuth password grant");
  const res = await fetchOutbound("https://acleddata.com/oauth/token", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    timeoutMs: 25_000,
    maxBytes: 64_000,
  });
  const text = await readLimited(res, 64_000).catch(() => "");
  if (!res.ok) {
    acledDebugLog("OAuth failed", { status: res.status, body: text.slice(0, 200) });
    throw new Error(
      text.includes("invalid") || text.includes("incorrect")
        ? "ACLED login failed — check ACLED_USERNAME / ACLED_PASSWORD (myACLED email + password)."
        : `ACLED token HTTP ${res.status}${text ? `: ${text.slice(0, 120)}` : ""}`,
    );
  }
  const json = JSON.parse(text) as AcledToken;
  return storeOAuthTokens(json);
}

async function acledOAuthRefresh(refreshToken: string): Promise<string> {
  acledDebugLog("OAuth refresh grant");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: "acled",
  });
  const res = await fetchOutbound("https://acleddata.com/oauth/token", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    timeoutMs: 25_000,
    maxBytes: 64_000,
  });
  const text = await readLimited(res, 64_000).catch(() => "");
  if (!res.ok) {
    acledDebugLog("OAuth refresh failed", { status: res.status, body: text.slice(0, 200) });
    throw new Error(`ACLED refresh HTTP ${res.status}`);
  }
  const json = JSON.parse(text) as AcledToken;
  return storeOAuthTokens(json);
}

async function acledToken(): Promise<string> {
  const staticToken = process.env.ACLED_ACCESS_TOKEN?.trim();
  if (staticToken) {
    acledDebugLog("Using ACLED_ACCESS_TOKEN from env");
    return staticToken;
  }

  const cached = metaGet(TOKEN_KEY);
  const exp = Number(metaGet(TOKEN_EXP_KEY));
  if (cached && exp > Date.now() + 60_000) return cached;

  const refresh = metaGet(REFRESH_KEY);
  if (refresh) {
    try {
      return await acledOAuthRefresh(refresh);
    } catch (error) {
      acledDebugLog("Refresh failed, falling back to password grant", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return acledOAuthPassword();
}

function startDate(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function rowToItem(row: AcledRow, index: number): ScrapedItem | null {
  const eventType = String(row.event_type ?? "Event").trim();
  const place = [row.location, row.admin1, row.country].filter(Boolean).join(", ");
  const notes = String(row.notes ?? "").trim();
  const title = place
    ? `${eventType}${row.sub_event_type ? ` · ${row.sub_event_type}` : ""}: ${place}`
    : `${eventType}: ${notes.slice(0, 80) || "ACLED event"}`;
  const summary = [
    row.event_date ? `Date ${row.event_date}` : "",
    row.fatalities && row.fatalities !== "0" ? `${row.fatalities} fatalities` : "",
    notes.slice(0, 400),
    row.source ? `Source: ${row.source}` : "",
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 500);

  const classified = classifyItem(title, summary);
  const topics = [...new Set(["conflict", ...classified.topics])].slice(0, 6);
  const locations = [...new Set([...(classified.locations ?? []), row.country, row.admin1].filter(Boolean))].slice(
    0,
    6,
  ) as string[];

  const externalId = String(row.event_id ?? `acled-${index}-${row.event_date ?? ""}-${place}`).slice(0, 120);

  return {
    externalId,
    title: title.slice(0, 280),
    summary: summary || null,
    url: `https://acleddata.com/data/?event_id=${encodeURIComponent(externalId)}`,
    author: "ACLED",
    publishedAt: row.event_date ? Date.parse(`${row.event_date}T12:00:00Z`) : null,
    topics,
    locations,
    tags: [...new Set(["acled", "conflict", ...classified.tags])].slice(0, 8),
  };
}

async function acledRead(url: string, token: string) {
  acledDebugLog("read", { url: url.split("?")[0] + "?" + url.split("?")[1]?.slice(0, 80) });
  const res = await fetchOutbound(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    timeoutMs: 45_000,
    maxBytes: 4_000_000,
  });
  const text = await readLimited(res, 4_000_000).catch(() => "");
  return { res, text };
}

export async function fetchAcledFeed(feedUrl: string): Promise<ScrapedItem[]> {
  if (!acledConfigured()) {
    throw new Error(
      "ACLED is not configured on the server. Add ACLED_USERNAME and ACLED_PASSWORD (myACLED) to .env.local.",
    );
  }
  const parsed = parseAcledFeedUrl(feedUrl);
  if (!parsed) throw new Error("Invalid ACLED layer URL");

  const cacheKey = `json:acled:${feedUrl}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    const rows = JSON.parse(cached) as AcledRow[];
    return rows.map((row, i) => rowToItem(row, i)).filter(Boolean) as ScrapedItem[];
  }

  const token = await acledToken();
  const params = new URLSearchParams({
    limit: String(parsed.limit),
    event_date: startDate(parsed.days),
    event_date_where: ">=",
    fields:
      "event_id|event_date|event_type|sub_event_type|country|admin1|location|latitude|longitude|fatalities|notes|source",
  });
  if (parsed.country) params.set("country", parsed.country);

  const url = `https://acleddata.com/api/acled/read?${params.toString()}`;
  let { res, text } = await acledRead(url, token);

  if (res.status === 401) {
    acledDebugLog("read 401, retry after fresh token");
    metaSet(TOKEN_KEY, "", 1000);
    const fresh = await acledToken();
    ({ res, text } = await acledRead(url, fresh));
  }

  if (!res.ok) {
    const parsedErr = parseAcledReadError(res.status, text);
    storeAcledLastError(parsedErr.message);
    acledDebugLog("read failed", { status: res.status, message: parsedErr.message });
    if (parsedErr.apiAccessDenied) {
      void runAcledProbe({ bearerToken: token }).catch(() => {});
    }
    throw new Error(parsedErr.apiAccessDenied ? `${parsedErr.message} — ${parsedErr.hint}` : parsedErr.message);
  }

  const payload = JSON.parse(text) as { data?: AcledRow[]; count?: number };
  const data = Array.isArray(payload.data) ? payload.data : [];
  acledDebugLog("read ok", { events: data.length, count: payload.count });
  cacheSet(cacheKey, "json", JSON.stringify(data), TTL.json);
  return data.map((row, i) => rowToItem(row, i)).filter(Boolean) as ScrapedItem[];
}

export { runAcledProbe, loadAcledProbe, loadAcledLastError } from "./acled-probe";
