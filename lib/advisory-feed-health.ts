import "server-only";

import { getDb } from "./db";
import { fetchOutbound, readLimited } from "./safe-url";
import { RSS_MAX_BYTES, UA } from "./http";

export type AdvisoryProbeTarget = {
  id: string;
  label: string;
  feedUrl: string;
  fallbackHint?: string;
};

/** Shipped advisory URLs we health-check (CISA + alternates). */
export const ADVISORY_PROBE_TARGETS: AdvisoryProbeTarget[] = [
  {
    id: "cisa-all",
    label: "CISA all advisories",
    feedUrl: "https://www.cisa.gov/cybersecurity-advisories/all.xml",
    fallbackHint: "If CISA RSS stops updating, enable the CSIRTS exploited layer (security pack).",
  },
  {
    id: "cisa-ics",
    label: "CISA ICS",
    feedUrl: "https://www.cisa.gov/cybersecurity-advisories/ics-advisories.xml",
  },
  {
    id: "csirts-kev",
    label: "CSIRTS KEV",
    feedUrl: "https://www.csirts.com/rss?exploited=1",
    fallbackHint: "Community aggregator when official CISA RSS is unavailable.",
  },
  {
    id: "cccs",
    label: "CCCS Canada",
    feedUrl: "https://www.cyber.gc.ca/api/cccs/atom/v1/get?feed=alerts_advisories&lang=en",
  },
];

export type AdvisoryProbeResult = {
  id: string;
  label: string;
  feedUrl: string;
  ok: boolean;
  status: number | null;
  checkedAt: number;
  bytes: number | null;
  hint: string | null;
};

const CACHE_KEY = "meta:advisory-feed-probes";
const CACHE_MS = 15 * 60 * 1000;

function readCache(): AdvisoryProbeResult[] | null {
  const row = getDb()
    .prepare("SELECT body, fetched_at FROM fetch_cache WHERE cache_key = ? AND expires_at > ?")
    .get(CACHE_KEY, Date.now()) as { body: string; fetched_at: number } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.body) as AdvisoryProbeResult[];
  } catch {
    return null;
  }
}

function writeCache(rows: AdvisoryProbeResult[]) {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO fetch_cache (cache_key, kind, body, fetched_at, expires_at)
       VALUES (?, 'live', ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at, expires_at = excluded.expires_at`,
    )
    .run(CACHE_KEY, JSON.stringify(rows), now, now + CACHE_MS);
}

async function probeOne(target: AdvisoryProbeTarget): Promise<AdvisoryProbeResult> {
  const checkedAt = Date.now();
  try {
    const res = await fetchOutbound(target.feedUrl, {
      headers: { "User-Agent": UA, Accept: "application/rss+xml,application/atom+xml,application/xml,*/*" },
      timeoutMs: 12_000,
      maxBytes: RSS_MAX_BYTES,
    });
    let bytes: number | null = null;
    if (res.ok) {
      const text = await readLimited(res, 512_000, { prefix: true });
      bytes = text.length;
      const looksLikeFeed = /<(rss|feed|rdf:RDF)\b/i.test(text) || text.includes("<item") || text.includes("<entry");
      return {
        id: target.id,
        label: target.label,
        feedUrl: target.feedUrl,
        ok: looksLikeFeed,
        status: res.status,
        checkedAt,
        bytes,
        hint: looksLikeFeed ? null : target.fallbackHint ?? "Response was not RSS/Atom.",
      };
    }
    return {
      id: target.id,
      label: target.label,
      feedUrl: target.feedUrl,
      ok: false,
      status: res.status,
      checkedAt,
      bytes: null,
      hint: target.fallbackHint ?? `Upstream HTTP ${res.status}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Probe failed";
    return {
      id: target.id,
      label: target.label,
      feedUrl: target.feedUrl,
      ok: false,
      status: null,
      checkedAt,
      bytes: null,
      hint: target.fallbackHint ? `${message}. ${target.fallbackHint}` : message,
    };
  }
}

/** Cached advisory feed probes (15 min). Pass `force` to refresh. */
export async function getAdvisoryFeedProbes(force = false): Promise<AdvisoryProbeResult[]> {
  if (!force) {
    const cached = readCache();
    if (cached?.length) return cached;
  }
  const rows: AdvisoryProbeResult[] = [];
  for (const target of ADVISORY_PROBE_TARGETS) {
    rows.push(await probeOne(target));
  }
  writeCache(rows);
  return rows;
}
