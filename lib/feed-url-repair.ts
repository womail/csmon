/** Fix shipped or saved feed URLs that upstream has renamed or removed. */

const NWS_ALERTS_ATOM = "https://api.weather.gov/alerts.atom?active=1";

const POLITICO_POLITICS = "https://rss.politico.com/politics-news.xml";

const REUTERS_WORLD =
  "https://news.google.com/rss/search?q=when:24h+site:reuters.com/world&ceid=US:en&hl=en-US&gl=US";

/** Exact old feed URLs → current replacements (case-sensitive path as stored). */
const EXACT: Record<string, string> = {
  "https://rss.politico.com/politics08.xml": POLITICO_POLITICS,
  "http://rss.politico.com/politics08.xml": POLITICO_POLITICS,
  "https://feeds.reuters.com/reuters/worldNews": REUTERS_WORLD,
  "http://feeds.reuters.com/reuters/worldNews": REUTERS_WORLD,
  "https://feeds.reuters.com/Reuters/worldNews": REUTERS_WORLD,
  "http://feeds.reuters.com/Reuters/worldNews": REUTERS_WORLD,
};

export function repairRssFeedUrl(feedUrl: string): string {
  const trimmed = feedUrl.trim();
  if (!trimmed) return feedUrl;
  const exact = EXACT[trimmed];
  if (exact) return exact;
  try {
    const url = new URL(trimmed);
    if (url.hostname === "api.weather.gov") {
      const path = url.pathname.replace(/\/$/, "");
      if (path === "/alerts/active.atom") return NWS_ALERTS_ATOM;
      if (path === "/alerts/active" && !url.searchParams.has("active")) return NWS_ALERTS_ATOM;
    }
    if (url.hostname === "feeds.reuters.com") {
      const path = url.pathname.replace(/\/$/, "").toLowerCase();
      if (path === "/reuters/worldnews" || path === "/reuters/worldnews/") return REUTERS_WORLD;
    }
    if (url.hostname === "rss.politico.com") {
      const path = url.pathname.replace(/\/$/, "").toLowerCase();
      if (path === "/politics08.xml") return POLITICO_POLITICS;
    }
  } catch {
    /* keep original */
  }
  return feedUrl;
}
