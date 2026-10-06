import "server-only";

import { classifyItem } from "../classify";
import { redditOAuthCredentials } from "../reddit-oauth-session";
import { parseSubredditFeedUrl, type RedditSort } from "../reddit";
import { UA } from "../http";
import { fetchOutbound, readLimited } from "../safe-url";
import type { ScrapedItem } from "../types";

type RedditListing = {
  data?: {
    children?: {
      data?: {
        id?: string;
        title?: string;
        selftext?: string;
        url?: string;
        permalink?: string;
        author?: string;
        created_utc?: number;
        subreddit?: string;
      };
    }[];
  };
};

async function redditToken(clientId: string, clientSecret: string) {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetchOutbound("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
    timeoutMs: 20_000,
    maxBytes: 32_000,
  });
  if (!res.ok) {
    throw new Error(
      res.status === 401
        ? "Reddit OAuth rejected the app id/secret. Check Options or REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET."
        : `Reddit OAuth token HTTP ${res.status}`,
    );
  }
  const json = JSON.parse(await readLimited(res, 32_000)) as { access_token?: string };
  if (!json.access_token) throw new Error("Reddit OAuth token missing access_token");
  return json.access_token;
}

function listingToItems(payload: RedditListing): ScrapedItem[] {
  const rows = payload.data?.children ?? [];
  const items: ScrapedItem[] = [];
  for (const child of rows) {
    const row = child.data;
    if (!row?.title) continue;
    const title = row.title.trim();
    const summary = (row.selftext ?? "").trim().slice(0, 500) || null;
    const classified = classifyItem(title, summary);
    const url = row.url?.startsWith("http")
      ? row.url
      : row.permalink
        ? `https://www.reddit.com${row.permalink}`
        : `https://www.reddit.com/r/${row.subreddit ?? "all"}`;
    items.push({
      externalId: `reddit-oauth:${row.id ?? title.slice(0, 40)}`,
      title: title.slice(0, 280),
      summary,
      url,
      author: row.author ?? null,
      publishedAt: row.created_utc ? Math.round(row.created_utc * 1000) : null,
      topics: [...new Set(["reddit", ...classified.topics.filter((t) => t !== "world")])].slice(0, 6),
      locations: classified.locations,
      tags: [...new Set(["reddit", ...classified.tags])].slice(0, 8),
    });
  }
  return items;
}

export async function fetchRedditOAuthFeed(feedUrl: string): Promise<ScrapedItem[]> {
  const creds = redditOAuthCredentials();
  if (!creds) {
    throw new Error(
      "Reddit OAuth not configured. Set app id/secret in Options → Data or REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET on the server.",
    );
  }
  const parsed = parseSubredditFeedUrl(feedUrl);
  if (!parsed?.subs.length) throw new Error("Invalid Reddit OAuth feed URL");

  const token = await redditToken(creds.clientId, creds.clientSecret);
  const path = `/r/${parsed.subs.join("+")}/${parsed.sort}.json?limit=50&raw_json=1`;
  const res = await fetchOutbound(`https://oauth.reddit.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": UA,
      Accept: "application/json",
    },
    timeoutMs: 25_000,
    maxBytes: 3_000_000,
  });
  if (!res.ok) throw new Error(`Reddit listing HTTP ${res.status}`);
  const json = JSON.parse(await readLimited(res, 3_000_000)) as RedditListing;
  return listingToItems(json);
}
