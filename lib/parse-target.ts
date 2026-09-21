import { parsePublicHttpUrl } from "./public-url";

export type Target =
  | { kind: "bsky"; handle: string }
  | { kind: "rss"; url: string }
  | { kind: "web"; url: string };

function withHttps(raw: string) {
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export function redditRssUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(withHttps(url));
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "reddit.com" && host !== "old.reddit.com" && host !== "new.reddit.com") {
    return null;
  }
  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  if (/\.rss$/i.test(path)) {
    return `https://www.reddit.com${path}${parsed.search}`;
  }
  const sub = path.match(/^\/r\/([^/]+)(?:\/(new|hot|top|rising))?$/i);
  if (sub) {
    const sort = sub[2] ?? "new";
    return `https://www.reddit.com/r/${sub[1]}/${sort}/.rss`;
  }
  return null;
}

export function parseTarget(
  input: string,
  opts?: { prefer?: "auto" | "rss" | "bsky" },
): Target {
  const raw = input.trim();
  if (!raw) throw new Error("Paste a Bluesky handle, RSS URL, or website.");
  const prefer = opts?.prefer ?? "auto";

  if (prefer === "rss") {
    const url = withHttps(raw.replace(/^@/, ""));
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Paste an RSS/Atom URL or a site that publishes a feed.");
    }
    parsePublicHttpUrl(parsed.toString());
    const reddit = redditRssUrl(parsed.toString());
    if (reddit) return { kind: "rss", url: reddit };
    const path = parsed.pathname.toLowerCase();
    if (
      parsed.searchParams.has("feed") ||
      /\.(rss|xml|atom)$/i.test(path) ||
      /\/(rss|feed|atom)(\/|$)/i.test(path)
    ) {
      return { kind: "rss", url: parsed.toString() };
    }
    return { kind: "web", url: parsed.toString() };
  }

  if (prefer === "bsky") {
    const handle = raw
      .replace(/^@/, "")
      .replace(/^(?:https?:\/\/)?bsky\.app\/profile\//i, "")
      .split(/[/?#]/)[0];
    if (!handle) throw new Error("Paste a Bluesky handle.");
    return { kind: "bsky", handle: decodeURIComponent(handle) };
  }

  const bskyProfile = raw.match(
    /(?:https?:\/\/)?bsky\.app\/profile\/([^/?#]+)/i,
  );
  if (bskyProfile) {
    return { kind: "bsky", handle: decodeURIComponent(bskyProfile[1]) };
  }

  const stripped = raw.replace(/^@/, "");
  if (
    !stripped.includes("://") &&
    /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(stripped) &&
    !stripped.includes("/")
  ) {
    return { kind: "bsky", handle: stripped.toLowerCase() };
  }
  if (/^[a-z0-9.-]+$/i.test(stripped) && stripped.includes(".")) {
    return { kind: "bsky", handle: stripped.toLowerCase() };
  }

  const url = withHttps(raw);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Could not parse that as a handle or URL.");
  }

  parsePublicHttpUrl(parsed.toString());
  const reddit = redditRssUrl(parsed.toString());
  if (reddit) return { kind: "rss", url: reddit };

  const path = parsed.pathname.toLowerCase();
  if (
    parsed.searchParams.has("feed") ||
    /\.(rss|xml|atom)$/i.test(path) ||
    /\/(rss|feed|atom)(\/|$)/i.test(path)
  ) {
    return { kind: "rss", url: parsed.toString() };
  }

  return { kind: "web", url: parsed.toString() };
}
