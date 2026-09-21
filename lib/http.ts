import "server-only";

import { cacheGet, cacheSet, TTL, type CacheKind } from "./cache";
import { APP_UA } from "./version";
import { fetchOutbound, readLimited } from "./safe-url";

export const UA = APP_UA;

async function cachedGet(
  cacheKey: string,
  kind: CacheKind,
  url: string,
  accept: string,
  timeoutMs: number,
  maxBytes: number,
): Promise<string> {
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const res = await fetchOutbound(url, {
    headers: { "User-Agent": UA, Accept: accept },
    timeoutMs,
    maxBytes,
  });
  if (!res.ok) {
    const host = (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return "";
      }
    })();
    if (res.status === 429 && host.endsWith("reddit.com")) {
      throw new Error(
        "Reddit public RSS allows about one request per minute per IP. Wait a minute, then load again.",
      );
    }
    throw new Error(`Upstream ${res.status}`);
  }
  const text = await readLimited(res, maxBytes);
  cacheSet(cacheKey, kind, text, TTL[kind]);
  return text;
}

export async function fetchJson<T>(url: string, timeoutMs = 12000): Promise<T> {
  const text = await cachedGet(`json:${url}`, "json", url, "application/json", timeoutMs, 4_000_000);
  return JSON.parse(text) as T;
}

export async function fetchLiveJson<T>(url: string, timeoutMs = 12000): Promise<T> {
  const text = await cachedGet(`live:${url}`, "live", url, "application/json", timeoutMs, 2_000_000);
  return JSON.parse(text) as T;
}

export async function fetchText(url: string, timeoutMs = 10000): Promise<string> {
  return cachedGet(
    `html:${url}`,
    "html",
    url,
    "text/html,application/xml,text/xml,*/*",
    timeoutMs,
    2_000_000,
  );
}

export async function fetchRssXml(url: string, timeoutMs = 12000): Promise<string> {
  return cachedGet(
    `rss:${url}`,
    "rss",
    url,
    "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*",
    timeoutMs,
    2_000_000,
  );
}

export async function mapPool<T, R>(
  items: T[],
  n: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const ret: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      ret[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, () => worker()),
  );
  return ret;
}
