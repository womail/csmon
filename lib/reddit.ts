export const REDDIT_STORAGE_KEY = "csmon.subreddits";
export const REDDIT_SOURCE_KEY = "rss:reddit:combined";
export const DEFAULT_SUBREDDITS = ["worldnews", "news", "europe"];
export const MAX_SUBREDDITS = 20;

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
