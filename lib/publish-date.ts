import type { CheerioAPI } from "cheerio";

const MAX_FUTURE_MS = 2 * 60 * 60 * 1000;
const MIN_MS = Date.parse("1990-01-01T00:00:00Z");

export function normalizePublishMs(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    return validPublishMs(ms);
  }
  const text = String(raw).trim();
  if (!text) return null;
  const asNum = Number(text);
  if (Number.isFinite(asNum) && /^\d+(\.\d+)?$/.test(text)) {
    const ms = asNum < 1e12 ? asNum * 1000 : asNum;
    return validPublishMs(ms);
  }
  const parsed = Date.parse(text);
  return validPublishMs(parsed);
}

function validPublishMs(ms: number) {
  if (!Number.isFinite(ms)) return null;
  const now = Date.now();
  if (ms < MIN_MS || ms > now + MAX_FUTURE_MS) return null;
  return Math.round(ms);
}

function jsonLdDates(node: unknown, out: number[]) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const entry of node) jsonLdDates(entry, out);
    return;
  }
  if (typeof node !== "object") return;
  const row = node as Record<string, unknown>;
  for (const key of ["datePublished", "dateCreated", "uploadDate", "dateModified"]) {
    const ts = normalizePublishMs(row[key]);
    if (ts) out.push(ts);
  }
  if (row["@graph"]) jsonLdDates(row["@graph"], out);
}

export function publishDateFromHtml($: CheerioAPI): number | null {
  const candidates: number[] = [];

  for (const sel of [
    'meta[property="article:published_time"]',
    'meta[property="og:published_time"]',
    'meta[name="article:published_time"]',
    'meta[name="pubdate"]',
    'meta[name="publishdate"]',
    'meta[name="date"]',
    'meta[name="DC.date.issued"]',
    'meta[itemprop="datePublished"]',
  ]) {
    const ts = normalizePublishMs($(sel).attr("content"));
    if (ts) candidates.push(ts);
  }

  $("time[datetime]").each((_, el) => {
    const ts = normalizePublishMs($(el).attr("datetime"));
    if (ts) candidates.push(ts);
  });

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      jsonLdDates(parsed, candidates);
    } catch {
      /* ignore */
    }
  });

  if (!candidates.length) return null;
  return Math.min(...candidates);
}

/** Best-effort date from an RSS/Atom entry (not ingest time). */
export function publishDateFromRssEntry(item: Record<string, unknown>) {
  const keys = [
    "isoDate",
    "pubDate",
    "published",
    "updated",
    "dc:date",
    "date",
    "created",
  ];
  const candidates: number[] = [];
  for (const key of keys) {
    const ts = normalizePublishMs(item[key]);
    if (ts) candidates.push(ts);
  }
  if (!candidates.length) return null;
  return Math.min(...candidates);
}
