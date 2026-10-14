import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { cacheGetEntry, cacheSet, cacheTouch, TTL, type CacheKind } from "./cache";
import { isRedditFeedUrl, isRedditRssSunset, redditRssHttpError, redditRssSunsetError } from "./reddit";
import { APP_UA } from "./version";
import { fetchOutbound, readLimited } from "./safe-url";

export const UA = APP_UA;

export type FetchOutcome = "cached" | "not_modified" | "fetched";

type FetchContext = {
  /** Skip a fresh cache hit and ask upstream (conditionally) anyway. */
  revalidate: boolean;
  outcomes: FetchOutcome[];
};

const fetchContext = new AsyncLocalStorage<FetchContext>();

/** Run a layer fetch and learn whether its upstream calls were cache hits, 304s, or full bodies. */
export async function withFetchContext<T>(
  options: { revalidate?: boolean },
  fn: () => Promise<T>,
): Promise<{ value: T; outcomes: FetchOutcome[] }> {
  const ctx: FetchContext = { revalidate: options.revalidate === true, outcomes: [] };
  const value = await fetchContext.run(ctx, fn);
  return { value, outcomes: ctx.outcomes };
}

const PER_HOST_LIMIT = 2;
const hostActive = new Map<string, number>();
const hostQueue = new Map<string, (() => void)[]>();

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function acquireHost(host: string) {
  if ((hostActive.get(host) ?? 0) < PER_HOST_LIMIT) {
    hostActive.set(host, (hostActive.get(host) ?? 0) + 1);
    return;
  }
  await new Promise<void>((resolve) => {
    const queue = hostQueue.get(host) ?? [];
    queue.push(resolve);
    hostQueue.set(host, queue);
  });
}

function releaseHost(host: string) {
  const next = hostQueue.get(host)?.shift();
  if (next) {
    next();
    return;
  }
  hostActive.set(host, Math.max(0, (hostActive.get(host) ?? 1) - 1));
}

async function cachedGet(
  cacheKey: string,
  kind: CacheKind,
  url: string,
  accept: string,
  timeoutMs: number,
  maxBytes: number,
): Promise<string> {
  const ctx = fetchContext.getStore();
  const entry = cacheGetEntry(cacheKey);
  if (entry?.fresh && !ctx?.revalidate) {
    ctx?.outcomes.push("cached");
    return entry.body;
  }
  if (isRedditFeedUrl(url)) {
    if (isRedditRssSunset()) throw redditRssSunsetError();
  }
  const headers: Record<string, string> = { "User-Agent": UA, Accept: accept };
  if (entry?.etag) headers["If-None-Match"] = entry.etag;
  if (entry?.lastModified) headers["If-Modified-Since"] = entry.lastModified;

  const host = hostOf(url);
  await acquireHost(host);
  try {
    const res = await fetchOutbound(url, { headers, timeoutMs, maxBytes });    if (res.status === 304 && entry) {
      cacheTouch(cacheKey, TTL[kind]);
      ctx?.outcomes.push("not_modified");
      return entry.body;
    }
    if (!res.ok) {
      if (res.status === 429 && host.endsWith("reddit.com")) {
        throw new Error(
          "Reddit public RSS allows about one request per minute per IP. Wait a minute, then load again.",
        );
      }
      if (isRedditFeedUrl(url) && (res.status === 404 || res.status === 410)) {
        throw redditRssHttpError(res.status);
      }
      throw new Error(`Upstream ${res.status}`);
    }
    const text = await readLimited(res, maxBytes);
    cacheSet(cacheKey, kind, text, TTL[kind], {
      etag: res.headers.get("etag"),
      lastModified: res.headers.get("last-modified"),
    });
    ctx?.outcomes.push("fetched");
    return text;
  } finally {
    releaseHost(host);
  }
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
    4_000_000,
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
