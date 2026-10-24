import * as cheerio from "cheerio";
import Parser from "rss-parser";
import { applySourceTopics, applyWeatherSourceTopics, classifyItem } from "../classify";
import { repairRssFeedUrl } from "../feed-url-repair";
import { fetchRssXml, fetchText, UA } from "../http";
import type { DiscoveredSource, ScrapeResult, ScrapedItem } from "../types";
import { publishDateFromRssEntry } from "../publish-date";
import { prepareRssXml } from "./rss-xml";

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": UA },
});

function hostOf(url: string) {
  return new URL(url).hostname.replace(/^www\./, "");
}

function isRedditUrl(url: string) {
  try {
    const host = hostOf(url).toLowerCase();
    return host === "reddit.com" || host.endsWith(".reddit.com") || host === "redd.it";
  } catch {
    return false;
  }
}

/** Atom `<author><name>` arrives as `{ name: string[] }`, which SQLite cannot bind. */
function authorText(value: unknown, fallback: string | null): string | null {
  if (typeof value === "string") {
    const text = value.replace(/\s+/g, " ").trim();
    return text ? text.slice(0, 180) : fallback;
  }
  if (Array.isArray(value)) {
    const joined = value
      .map((part) => authorText(part, null))
      .filter((part): part is string => Boolean(part))
      .join(", ");
    return joined ? joined.slice(0, 180) : fallback;
  }
  if (value && typeof value === "object" && "name" in value) {
    return authorText((value as { name: unknown }).name, fallback);
  }
  return fallback;
}

function asItems(feed: Parser.Output<Parser.Item>, fallbackUrl: string): ScrapedItem[] {
  return (feed.items ?? []).slice(0, 40).map((item, index) => {
    const title = (item.title || item.contentSnippet || "Untitled").replace(/\s+/g, " ").slice(0, 220);
    const summary = (item.contentSnippet || item.content || "").replace(/<[^>]+>/g, "").slice(0, 280) || null;
    const url = item.link || fallbackUrl;
    const text = `${title} ${summary ?? ""}`;
    let classified = classifyItem(title, summary);
    classified = applySourceTopics(classified, { feedUrl: fallbackUrl });
    classified = applyWeatherSourceTopics(classified, { feedUrl: fallbackUrl }, text);
    if (isRedditUrl(url) || isRedditUrl(fallbackUrl)) {
      classified.topics = ["reddit", ...classified.topics.filter((topic) => topic !== "reddit")].slice(0, 6);
      classified.tags = ["reddit", ...classified.tags.filter((tag) => tag !== "reddit")].slice(0, 5);
    }
    return {
      externalId: item.guid || item.link || `${fallbackUrl}#${index}`,
      title,
      summary,
      url,
      author: authorText(item.creator, feed.title || null),
      publishedAt: publishDateFromRssEntry(item as unknown as Record<string, unknown>),
      tags: classified.tags,
      topics: classified.topics,
      locations: classified.locations,
    };
  });
}

export async function discoverRss(pageUrl: string): Promise<string | null> {
  try {
    const html = await fetchText(pageUrl, 8000);
    const $ = cheerio.load(html);
    const href = $('link[rel="alternate"]')
      .filter((_, el) => {
        const type = ($(el).attr("type") || "").toLowerCase();
        return type.includes("rss") || type.includes("atom") || type.includes("xml");
      })
      .first()
      .attr("href");
    if (href) return new URL(href, pageUrl).toString();
  } catch {
    /* try well-known paths */
  }

  const base = new URL(pageUrl);
  const candidates = ["/feed", "/rss", "/atom.xml", "/feed.xml", "/index.xml", "/rss.xml"];
  for (const path of candidates) {
    const url = new URL(path, `${base.protocol}//${base.host}`).toString();
    try {
      const xml = await fetchRssXml(url, 8000);
      const feed = await parser.parseString(prepareRssXml(xml));
      if (feed.items?.length) return url;
    } catch {
      /* next */
    }
  }
  return null;
}

async function parseFeedXml(xml: string) {
  return parser.parseString(prepareRssXml(xml));
}

export async function fetchRss(feedUrl: string): Promise<ScrapedItem[]> {
  feedUrl = repairRssFeedUrl(feedUrl);
  const xml = await fetchRssXml(feedUrl);
  const feed = await parseFeedXml(xml);
  return asItems(feed, feedUrl);
}

export async function scrapeRssUrl(url: string): Promise<ScrapeResult> {
  const xml = await fetchRssXml(url);
  const feed = await parseFeedXml(xml);
  const host = hostOf(url);
  const items = asItems(feed, url);
  const source: DiscoveredSource = {
    key: `rss:${url}`,
    name: feed.title || host,
    handle: host,
    url: feed.link || url,
    feedUrl: url,
    platform: "rss",
    kind: "feed",
    description: feed.description ?? null,
    avatarUrl: null,
    reason: "self",
    weight: 100,
    sample: items[0]?.title,
  };
  return {
    user: {
      handle: host,
      platform: "rss",
      did: null,
      displayName: feed.title ?? host,
      avatarUrl: null,
      description: feed.description ?? null,
      profileUrl: feed.link || url,
    },
    sources: [source],
    items,
  };
}

export async function scrapeWeb(url: string): Promise<ScrapeResult> {
  const host = hostOf(url);
  const feedUrl = await discoverRss(url);
  if (feedUrl) {
    const result = await scrapeRssUrl(feedUrl);
    result.user.profileUrl = url;
    result.user.handle = host;
    result.sources[0].url = url;
    result.sources[0].reason = "self";
    return result;
  }

  return {
    user: {
      handle: host,
      platform: "web",
      did: null,
      displayName: host,
      avatarUrl: null,
      description: "No RSS feed found",
      profileUrl: url,
    },
    sources: [
      {
        key: `web:${host}`,
        name: host,
        handle: host,
        url,
        feedUrl: null,
        platform: "web",
        kind: "site",
        description: "No RSS feed found — enable nearby Bluesky/RSS sources instead",
        avatarUrl: null,
        reason: "self",
        weight: 100,
      },
    ],
    items: [],
  };
}

export async function hydrateLinkSources(sources: DiscoveredSource[]) {
  const links = sources.filter((s) => s.reason === "link" && s.platform === "web" && !s.feedUrl);
  await Promise.all(
    links.slice(0, 8).map(async (source) => {
      const feedUrl = await discoverRss(source.url).catch(() => null);
      if (!feedUrl) return;
      source.feedUrl = feedUrl;
      source.platform = "rss";
      source.kind = "feed";
      source.key = `rss:${feedUrl}`;
    }),
  );
  return sources;
}
