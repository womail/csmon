import type { Item, Source } from "./types";

export type SourceHint = {
  host: string;
  url: string;
  count: number;
  sample: string;
  feedUrl: string | null;
};

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const SKIP = new Set([
  "bsky.app",
  "twitter.com",
  "x.com",
  "facebook.com",
  "youtube.com",
  "youtu.be",
  "instagram.com",
  "tiktok.com",
  "bit.ly",
  "t.co",
]);

export function hintSources(items: Item[], sources: Source[]): SourceHint[] {
  const known = new Set(
    sources.flatMap((s) => [s.handle, hostOf(s.url), hostOf(s.feedUrl ?? "")].filter(Boolean) as string[]),
  );
  const tally = new Map<string, SourceHint>();
  for (const item of items) {
    const host = hostOf(item.url);
    if (!host || SKIP.has(host) || known.has(host)) continue;
    const current = tally.get(host) ?? {
      host,
      url: `https://${host}`,
      count: 0,
      sample: item.title,
      feedUrl: null,
    };
    current.count += 1;
    tally.set(host, current);
  }
  return [...tally.values()].sort((a, b) => b.count - a.count).slice(0, 12);
}

export async function probeHint(hint: SourceHint): Promise<SourceHint> {
  const { discoverRss } = await import("./scrape/rss");
  const feedUrl = await discoverRss(hint.url).catch(() => null);
  return { ...hint, feedUrl };
}
