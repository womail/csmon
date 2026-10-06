import "server-only";

import { cacheGet, cacheGetStale, cacheSet, TTL } from "../cache";
import { getDb } from "../db";
import { classifyItem } from "../classify";
import { isGdeltDocUrl, repairGdeltFeedUrl } from "../gdelt";
import { UA } from "../http";
import { isKnownPlace, resolvePlace } from "../places";
import { fetchOutbound, readLimited } from "../safe-url";
import type { ScrapedItem } from "../types";

const GAP_MS = 6_000;
const COOLDOWN_MS = 90_000;
const GDELT_SLOT_KEY = "meta:gdelt:last_request_ms";
const GDELT_COOL_KEY = "meta:gdelt:cool_until_ms";
const FETCH_TIMEOUT_MS = 45_000;
const CONNECT_TIMEOUT_MS = 30_000;
const MAX_BYTES = 2_000_000;

const UNREACHABLE =
  "GDELT did not respond in time. The API is often slow — try again in a minute, or use cached articles if you loaded this query before.";

let tail: Promise<void> = Promise.resolve();
let lastNetworkAt = 0;

function readPersistedGdeltRequestAt(): number {
  const row = getDb()
    .prepare("SELECT body FROM fetch_cache WHERE cache_key = ?")
    .get(GDELT_SLOT_KEY) as { body: string } | undefined;
  const n = Number(row?.body);
  return Number.isFinite(n) ? n : 0;
}

function persistGdeltRequestAt(at: number) {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO fetch_cache (cache_key, kind, body, fetched_at, expires_at)
       VALUES (?, 'live', ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at, expires_at = excluded.expires_at`,
    )
    .run(GDELT_SLOT_KEY, String(at), now, now + 365 * 24 * 60 * 60 * 1000);
}

async function waitGdeltNetworkGap() {
  const last = Math.max(lastNetworkAt, readPersistedGdeltRequestAt());
  const wait = GAP_MS - (Date.now() - last);
  if (wait > 0) await sleep(wait);
}

function touchGdeltNetworkAt() {
  const at = Date.now();
  lastNetworkAt = at;
  persistGdeltRequestAt(at);
}

function readCoolUntil(): number {
  const row = getDb()
    .prepare("SELECT body FROM fetch_cache WHERE cache_key = ?")
    .get(GDELT_COOL_KEY) as { body: string } | undefined;
  const n = Number(row?.body);
  return Number.isFinite(n) ? n : 0;
}

function persistCoolUntil(at: number) {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO fetch_cache (cache_key, kind, body, fetched_at, expires_at)
       VALUES (?, 'live', ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at, expires_at = excluded.expires_at`,
    )
    .run(GDELT_COOL_KEY, String(at), now, at);
}

/** After a 429, skip further GDELT calls until this time so the IP can recover. */
export function gdeltCoolUntil(): number {
  return readCoolUntil();
}

const RATE_LIMIT =
  "GDELT asks for one request every 5 seconds. Wait a few seconds, then load again.";

type GdeltArticle = {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isGdeltRateLimitError(error: unknown) {
  return error instanceof Error && /one request every 5 seconds/i.test(error.message);
}

/** GDELT query validation — retrying will not help. */
export function isGdeltQuerySyntaxError(error: unknown) {
  if (!(error instanceof Error)) return false;
  if (isGdeltRateLimitError(error)) return false;
  return /Parentheses may only|may only be used around OR|invalid query|query syntax/i.test(error.message);
}

export function isGdeltTransientError(error: unknown) {
  if (isGdeltRateLimitError(error)) return true;
  if (!(error instanceof Error)) return false;
  if (error.message === UNREACHABLE) return true;
  if (/fetch failed|timed out|timeout|ECONNRESET|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(error.message)) {
    return true;
  }
  let cause: unknown = error.cause;
  for (let depth = 0; depth < 3 && cause; depth++) {
    if (typeof cause === "object" && cause && "code" in cause) {
      const code = String((cause as { code: unknown }).code);
      if (/TIMEOUT|UND_ERR|ECONN|ETIMEDOUT|ENOTFOUND/i.test(code)) return true;
    }
    cause = cause instanceof Error ? cause.cause : undefined;
  }
  return false;
}

function unreachableError() {
  return new Error(UNREACHABLE);
}

/** GDELT asks for one request every 5 seconds. Cache hits skip the queue. */
function withGdeltSlot<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(() => fn());
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function parseSeenDate(value: string | undefined) {
  if (!value) return null;
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  );
}

const COMPACT_PLACES: Record<string, string> = {
  ireland: "Ireland",
  unitedkingdom: "UK",
  greatbritain: "UK",
  unitedstates: "US",
  unitedstatesofamerica: "US",
};

function placeFromCountry(raw: string | undefined) {
  const name = raw?.trim();
  if (!name) return null;
  const compact = name.toLowerCase().replace(/[^a-z]/g, "");
  if (COMPACT_PLACES[compact]) return COMPACT_PLACES[compact];
  const resolved = resolvePlace(name);
  if (isKnownPlace(name) || isKnownPlace(resolved)) return resolved;
  if (/^[A-Za-z][A-Za-z .'-]{1,40}$/.test(name)) return resolved;
  return null;
}

export function gdeltArticlesToItems(text: string): ScrapedItem[] {
  let data: { articles?: GdeltArticle[] };
  try {
    data = JSON.parse(text) as { articles?: GdeltArticle[] };
  } catch {
    throw new Error("GDELT returned invalid JSON");
  }
  const articles = Array.isArray(data.articles) ? data.articles : [];
  const items: ScrapedItem[] = [];
  for (const article of articles) {
    const url = article.url?.trim() ?? "";
    const title = (article.title || "").replace(/\s+/g, " ").trim().slice(0, 220);
    if (!url || !title || !/^https?:\/\//i.test(url)) continue;
    const domain = (article.domain || "").replace(/^www\./, "").slice(0, 80);
    const language = (article.language || "").trim();
    const country = placeFromCountry(article.sourcecountry);
    const summary = [domain, language, article.sourcecountry?.trim()].filter(Boolean).join(" · ").slice(0, 180) || null;
    const classified = classifyItem(title, summary);
    const locations = [...classified.locations];
    if (country && !locations.includes(country)) locations.unshift(country);
    items.push({
      externalId: url,
      title,
      summary,
      url,
      author: domain || null,
      publishedAt: parseSeenDate(article.seendate),
      tags: classified.tags,
      topics: classified.topics,
      locations: locations.slice(0, 6),
    });
  }
  return items;
}

function rateLimitError() {
  return new Error(RATE_LIMIT);
}

/** One HTTP round trip. Returns article JSON, or null when GDELT sent bare `{}`. */
async function loadGdeltBodyOnce(url: string): Promise<string | null> {
  await waitGdeltNetworkGap();
  let res: Response;
  try {
    res = await fetchOutbound(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      timeoutMs: FETCH_TIMEOUT_MS,
      connectTimeoutMs: CONNECT_TIMEOUT_MS,
      maxBytes: MAX_BYTES,
    });
  } catch (error) {
    touchGdeltNetworkAt();
    if (isGdeltTransientError(error)) throw unreachableError();
    throw error;
  }
  if (res.status === 429) {
    touchGdeltNetworkAt();
    await readLimited(res, 4_000).catch(() => "");
    throw rateLimitError();
  }
  touchGdeltNetworkAt();
  if (!res.ok) throw new Error(`GDELT returned ${res.status}`);
  const text = (await readLimited(res, MAX_BYTES)).trim();
  if (!text.startsWith("{")) {
    const message = text.replace(/\s+/g, " ").slice(0, 220);
    if (/one every 5 seconds/i.test(message)) throw rateLimitError();
    throw new Error(message || "GDELT returned an unexpected response");
  }
  let parsed: { articles?: unknown; message?: unknown; error?: unknown };
  try {
    parsed = JSON.parse(text) as { articles?: unknown; message?: unknown; error?: unknown };
  } catch {
    throw new Error("GDELT returned invalid JSON");
  }
  if (Array.isArray(parsed.articles)) return text;
  const note = [parsed.message, parsed.error].find((value) => typeof value === "string" && value.trim()) as
    | string
    | undefined;
  if (note) {
    const message = note.replace(/\s+/g, " ").slice(0, 220);
    if (/one every 5 seconds/i.test(message)) throw rateLimitError();
    throw new Error(message);
  }
  return null;
}

async function fetchGdeltNetwork(feedUrl: string, cacheKey: string): Promise<string | null> {
  const cool = readCoolUntil();
  if (cool > Date.now()) {
    const secs = Math.ceil((cool - Date.now()) / 1000);
    throw new Error(`${RATE_LIMIT} About ${secs}s left on the cooldown.`);
  }
  return withGdeltSlot(async () => {
    try {
      const body = await loadGdeltBodyOnce(feedUrl);
      if (body) {
        cacheSet(cacheKey, "json", body, TTL.json);
        return body;
      }
      return null;
    } catch (error) {
      if (isGdeltRateLimitError(error)) persistCoolUntil(Date.now() + COOLDOWN_MS);
      throw error;
    }
  });
}

export async function fetchGdeltDoc(feedUrl: string): Promise<ScrapedItem[]> {
  feedUrl = repairGdeltFeedUrl(feedUrl);
  if (!isGdeltDocUrl(feedUrl)) throw new Error("Not a GDELT document URL");
  const cacheKey = `json:${feedUrl}`;
  const cached = cacheGet(cacheKey);
  if (cached) return gdeltArticlesToItems(cached);

  const stale = cacheGetStale(cacheKey);

  try {
    const text = await fetchGdeltNetwork(feedUrl, cacheKey);
    if (text) return gdeltArticlesToItems(text);
    return [];
  } catch (error) {
    if (isGdeltTransientError(error) && stale) {
      return gdeltArticlesToItems(stale);
    }
    throw error;
  }
}
