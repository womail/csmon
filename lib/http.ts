import "server-only";

import { cacheGet, cacheSet, TTL } from "./cache";

export const UA = "csmon/0.1 (local current-situation monitor)";

export async function fetchJson<T>(url: string, timeoutMs = 12000): Promise<T> {
  const cached = cacheGet(`json:${url}`);
  if (cached) return JSON.parse(cached) as T;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${url}`);
  }
  const text = await res.text();
  cacheSet(`json:${url}`, "json", text, TTL.json);
  return JSON.parse(text) as T;
}

export async function fetchLiveJson<T>(url: string, timeoutMs = 12000): Promise<T> {
  const cached = cacheGet(`live:${url}`);
  if (cached) return JSON.parse(cached) as T;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${url}`);
  }
  const text = await res.text();
  cacheSet(`live:${url}`, "live", text, TTL.live);
  return JSON.parse(text) as T;
}

export async function fetchText(url: string, timeoutMs = 10000): Promise<string> {
  const cached = cacheGet(`html:${url}`);
  if (cached) return cached;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xml,text/xml,*/*" },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${url}`);
  }
  const text = await res.text();
  cacheSet(`html:${url}`, "html", text, TTL.html);
  return text;
}

export async function fetchRssXml(url: string, timeoutMs = 12000): Promise<string> {
  const cached = cacheGet(`rss:${url}`);
  if (cached) return cached;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*" },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
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
        "Reddit public RSS allows about one request per minute per IP. Wait, or add only one subreddit.",
      );
    }
    throw new Error(`${res.status} ${url}`);
  }
  const text = await res.text();
  cacheSet(`rss:${url}`, "rss", text, TTL.rss);
  return text;
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
