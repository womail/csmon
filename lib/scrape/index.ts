import { parseTarget } from "../parse-target";
import type { ScrapedItem, Source } from "../types";
import { fetchBskySource, scrapeBskyUser } from "./bsky";
import { fetchRss, hydrateLinkSources, scrapeRssUrl, scrapeWeb } from "./rss";

export async function scrapeInput(
  input: string,
  prefer: "auto" | "rss" | "bsky" = "auto",
) {
  const target = parseTarget(input, { prefer });
  if (target.kind === "bsky") {
    const result = await scrapeBskyUser(target.handle);
    result.sources = await hydrateLinkSources(result.sources);
    return result;
  }
  if (target.kind === "rss") return scrapeRssUrl(target.url);
  return scrapeWeb(target.url);
}

export async function fetchSourceItems(source: Source): Promise<ScrapedItem[]> {
  if (source.platform === "bluesky" && source.handle) {
    return fetchBskySource(source.handle);
  }
  if (source.feedUrl) {
    return fetchRss(source.feedUrl);
  }
  return [];
}
