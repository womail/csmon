/** Fix shipped or saved feed URLs that upstream has renamed or removed. */

const NWS_ALERTS_ATOM = "https://api.weather.gov/alerts.atom?active=1";

export function repairRssFeedUrl(feedUrl: string): string {
  const trimmed = feedUrl.trim();
  if (!trimmed) return feedUrl;
  try {
    const url = new URL(trimmed);
    if (url.hostname !== "api.weather.gov") return feedUrl;
    const path = url.pathname.replace(/\/$/, "");
    if (path === "/alerts/active.atom") return NWS_ALERTS_ATOM;
    if (path === "/alerts/active" && !url.searchParams.has("active")) return NWS_ALERTS_ATOM;
  } catch {
    /* keep original */
  }
  return feedUrl;
}
