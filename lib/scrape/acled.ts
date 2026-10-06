import "server-only";

import { classifyItem } from "../classify";
import { acledConfigured, parseAcledFeedUrl } from "../acled";
import { cacheGet, cacheSet, TTL } from "../cache";
import { getDb } from "../db";
import { fetchOutbound, readLimited } from "../safe-url";
import { UA } from "../http";
import type { ScrapedItem } from "../types";

const TOKEN_KEY = "meta:acled:token";
const TOKEN_EXP_KEY = "meta:acled:token_exp";

type AcledToken = { access_token: string; expires_in?: number };

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
  const row = getDb().prepare("SELECT body FROM fetch_cache WHERE cache_key = ?").get(key) as
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

async function acledToken(): Promise<string> {
  const cached = metaGet(TOKEN_KEY);
  const exp = Number(metaGet(TOKEN_EXP_KEY));
  if (cached && exp > Date.now() + 60_000) return cached;

  const username = process.env.ACLED_USERNAME?.trim();
  const password = process.env.ACLED_PASSWORD?.trim();
  if (!username || !password) {
    throw new Error("ACLED credentials missing. Set ACLED_USERNAME and ACLED_PASSWORD on the server.");
  }

  const body = new URLSearchParams({
    username,
    password,
    grant_type: "password",
    client_id: "acled",
    scope: "authenticated",
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
  if (!res.ok) {
    const detail = await readLimited(res, 8_000).catch(() => "");
    throw new Error(
      detail.includes("invalid")
        ? "ACLED login failed — check ACLED_USERNAME / ACLED_PASSWORD (myACLED account)."
        : `ACLED token HTTP ${res.status}`,
    );
  }
  const json = JSON.parse(await readLimited(res, 64_000)) as AcledToken;
  if (!json.access_token) throw new Error("ACLED token response missing access_token");
  const ttl = Math.min(86_400, Math.max(300, (json.expires_in ?? 3600) - 120)) * 1000;
  metaSet(TOKEN_KEY, json.access_token, ttl);
  metaSet(TOKEN_EXP_KEY, String(Date.now() + ttl), ttl);
  return json.access_token;
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
  const topics = [...new Set(["conflict", ...classified.topics.filter((t) => t !== "world")])].slice(0, 6);
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
  const res = await fetchOutbound(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    timeoutMs: 45_000,
    maxBytes: 4_000_000,
  });
  if (!res.ok) {
    throw new Error(`ACLED read HTTP ${res.status}`);
  }
  const text = await readLimited(res, 4_000_000);
  const payload = JSON.parse(text) as { data?: AcledRow[]; count?: number };
  const data = Array.isArray(payload.data) ? payload.data : [];
  cacheSet(cacheKey, "json", JSON.stringify(data), TTL.json);
  return data.map((row, i) => rowToItem(row, i)).filter(Boolean) as ScrapedItem[];
}
