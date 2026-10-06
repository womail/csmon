export const REDDIT_STORAGE_KEY = "csmon.subreddits";
export const REDDIT_SOURCE_KEY = "rss:reddit:combined";
export const REDDIT_SUNSET_BANNER_KEY = "csmon.reddit-sunset-banner";
export const DEFAULT_SUBREDDITS = ["worldnews", "news", "europe"];
export const MAX_SUBREDDITS = 20;

/** Reddit ends public RSS on this date (UTC). */
export const REDDIT_RSS_SUNSET_MS = Date.UTC(2026, 10, 13, 0, 0, 0);

export const REDDIT_RSS_SUNSET_LABEL = "13 Nov 2026";

export const REDDIT_RSS_SUNSET_BANNER =
  "Reddit RSS ends 13 Nov 2026 — plan to drop or replace. There is no 1:1 public replacement for arbitrary subreddits.";

export const REDDIT_RSS_REPLACEMENTS =
  "Use Bluesky handles in RSS/scrape, GDELT keyword queries (header GDELT), or wire RSS from the same beat. Optional Reddit OAuth (your app id/secret in Options) may be added later for post-shutdown access.";

/** Prefix for errors that should disable a Reddit RSS layer without 502 spam. */
export const REDDIT_RSS_ERROR_PREFIX = "REDDIT_RSS:";

const SUBREDDIT_GDELT_QUERY: Record<string, string> = {
  worldnews: "worldnews OR international OR geopolitics",
  news: "breaking news OR headline",
  europe: "Europe OR european union OR Brussels",
  ukpolitics: "UK politics OR Westminster",
  geopolitics: "geopolitics OR foreign policy",
  technology: "technology OR cyber OR software",
  cybersecurity: "cybersecurity OR ransomware OR breach",
  netsec: "cybersecurity OR vulnerability OR exploit",
};

export function isRedditRssSunset(now = Date.now()) {
  return now >= REDDIT_RSS_SUNSET_MS;
}

export function redditRssDaysUntilSunset(now = Date.now()) {
  return Math.ceil((REDDIT_RSS_SUNSET_MS - now) / (24 * 60 * 60 * 1000));
}

export function isRedditFeedUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host.endsWith("reddit.com") || host === "redd.it";
  } catch {
    return false;
  }
}

export function redditRssSunsetError() {
  return new Error(
    `${REDDIT_RSS_ERROR_PREFIX}Reddit public RSS ended ${REDDIT_RSS_SUNSET_LABEL}. Use GDELT, Bluesky, or wire RSS instead.`,
  );
}

export function redditRssHttpError(status: number) {
  return new Error(
    `${REDDIT_RSS_ERROR_PREFIX}Reddit RSS returned HTTP ${status} (feed removed). Layer disabled — try GDELT or wire RSS.`,
  );
}

export function isRedditRssFetchError(error: unknown) {
  return error instanceof Error && error.message.startsWith(REDDIT_RSS_ERROR_PREFIX);
}

export function redditRssErrorDetail(error: unknown) {
  if (!(error instanceof Error)) return "Reddit RSS unavailable.";
  return error.message.replace(REDDIT_RSS_ERROR_PREFIX, "").trim();
}

export type SubredditGdeltSuggestion = {
  id: string;
  name: string;
  query: string;
};

/** Turn saved sub names into GDELT DOC search ideas (not subreddit feeds). */
export function gdeltSuggestionsFromSubreddits(subs: string[]): SubredditGdeltSuggestion[] {
  const names = uniqueSubreddits(subs);
  return names.map((sub) => ({
    id: `from-${sub}`.slice(0, 32),
    name: `r/${sub}`,
    query: SUBREDDIT_GDELT_QUERY[sub] ?? sub.replace(/_/g, " "),
  }));
}

export type RedditSort = "hot" | "new";

export function normalizeSubreddit(raw: string): string | null {
  const token = raw.trim();
  if (!token) return null;
  let name = token;
  const fromUrl = token.match(
    /(?:^|reddit\.com|old\.reddit\.com|new\.reddit\.com)\/r\/([^/?#]+)/i,
  );
  if (fromUrl) name = fromUrl[1] ?? name;
  else name = token.replace(/^\/?r\//i, "");
  name = (name.split(/[/?#]/)[0] ?? "").split("+")[0] ?? "";
  name = name.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (name.length < 2 || name.length > 21) return null;
  return name;
}

export function parseSubredditInput(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const fromUrl = trimmed.match(
    /(?:reddit\.com|old\.reddit\.com|new\.reddit\.com)\/r\/([^/?#]+)/i,
  );
  const chunk = fromUrl?.[1] ?? trimmed.replace(/^\/?r\//i, "");
  const seen = new Set<string>();
  const names: string[] = [];
  for (const piece of chunk.split(/[\s,+]+/)) {
    const name = normalizeSubreddit(piece);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

export function uniqueSubreddits(subs: string[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of subs) {
    const name = normalizeSubreddit(raw);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
    if (names.length >= MAX_SUBREDDITS) break;
  }
  return names;
}

export function redditOAuthFeedUrl(subs: string[], sort: RedditSort = "hot"): string {
  const names = uniqueSubreddits(subs);
  if (!names.length) throw new Error("Add at least one subreddit.");
  return `reddit-oauth://r/${names.join("+")}/${sort}`;
}

export function isRedditOAuthFeedUrl(url: string | null | undefined) {
  return Boolean(url?.startsWith("reddit-oauth://"));
}

export function parseSubredditFeedUrl(feedUrl: string): { subs: string[]; sort: RedditSort } | null {
  if (isRedditOAuthFeedUrl(feedUrl)) {
    const rest = feedUrl.replace("reddit-oauth://", "");
    const match = rest.match(/^r\/([^/]+)\/(hot|new)$/i);
    if (!match) return null;
    const subs = uniqueSubreddits(match[1].split("+"));
    const sort = (match[2].toLowerCase() as RedditSort) || "hot";
    return subs.length ? { subs, sort } : null;
  }
  if (isRedditFeedUrl(feedUrl)) {
    try {
      const url = new URL(feedUrl);
      const parts = url.pathname.split("/").filter(Boolean);
      const rIndex = parts.indexOf("r");
      if (rIndex < 0 || !parts[rIndex + 1]) return null;
      const subs = uniqueSubreddits(parts[rIndex + 1].split("+"));
      const sort = (parts[rIndex + 2] as RedditSort) || "hot";
      return subs.length ? { subs, sort: sort === "new" ? "new" : "hot" } : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function combinedRedditRssUrl(subs: string[], sort: RedditSort = "hot"): string {
  const names = uniqueSubreddits(subs);
  if (!names.length) throw new Error("Add at least one subreddit.");
  return `https://www.reddit.com/r/${names.join("+")}/${sort}/.rss?limit=100`;
}

export function redditListingUrl(subs: string[], sort: RedditSort = "hot"): string {
  const names = uniqueSubreddits(subs);
  if (!names.length) return "https://www.reddit.com/";
  return `https://www.reddit.com/r/${names.join("+")}/${sort}/`;
}

export function loadSubreddits(): string[] {
  if (typeof window === "undefined") return DEFAULT_SUBREDDITS;
  try {
    const raw = window.localStorage.getItem(REDDIT_STORAGE_KEY);
    if (!raw) return DEFAULT_SUBREDDITS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_SUBREDDITS;
    const names = uniqueSubreddits(parsed.map((value) => String(value)));
    return names.length ? names : DEFAULT_SUBREDDITS;
  } catch {
    return DEFAULT_SUBREDDITS;
  }
}

export function saveSubreddits(subs: string[]) {
  window.localStorage.setItem(REDDIT_STORAGE_KEY, JSON.stringify(uniqueSubreddits(subs)));
}
