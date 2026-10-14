import "server-only";

import { cacheGet, cacheSet } from "./cache";
import { normalizeCveId } from "./nvd";
import { fetchOutbound, readLimited } from "./safe-url";
import { APP_UA } from "./version";
import {
  EPSS_API,
  OSV_API,
  osvAliases,
  parseEpssResponse,
  summarizeOsv,
  type EpssScore,
  type OsvSummary,
} from "./vuln-intel";

/** EPSS publishes once a day. */
const EPSS_TTL = 12 * 60 * 60 * 1000;
const OSV_TTL = 24 * 60 * 60 * 1000;
const EPSS_CHUNK = 100;

async function getJson(url: string): Promise<unknown | null> {
  const res = await fetchOutbound(url, {
    headers: { "User-Agent": APP_UA, Accept: "application/json" },
    timeoutMs: 15000,
    maxBytes: 3_000_000,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Upstream ${res.status}`);
  return JSON.parse(await readLimited(res, 3_000_000)) as unknown;
}

/** Scores for up to `cap` CVEs; each CVE is cached on its own so overlapping lists stay cheap. */
export async function fetchEpssScores(cveIds: string[], cap = 400): Promise<EpssScore[]> {
  const ids = [...new Set(cveIds.map((id) => normalizeCveId(id)).filter(Boolean))].slice(0, cap) as string[];
  const out: EpssScore[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    const cached = cacheGet(`epss:${id}`);
    if (cached === null) missing.push(id);
    else if (cached !== "null") out.push(JSON.parse(cached) as EpssScore);
  }
  for (let i = 0; i < missing.length; i += EPSS_CHUNK) {
    const chunk = missing.slice(i, i + EPSS_CHUNK);
    const body = await getJson(`${EPSS_API}?cve=${chunk.join(",")}&limit=${EPSS_CHUNK}`);
    const scores = parseEpssResponse(body);
    const byId = new Map(scores.map((row) => [row.cve, row]));
    for (const id of chunk) {
      const row = byId.get(id);
      cacheSet(`epss:${id}`, "json", row ? JSON.stringify(row) : "null", EPSS_TTL);
      if (row) out.push(row);
    }
  }
  return out;
}

/** OSV record for the CVE plus up to two GitHub advisory aliases (where package names live). */
export async function fetchOsvSummary(cveId: string): Promise<OsvSummary | null> {
  const id = normalizeCveId(cveId);
  if (!id) return null;
  const key = `osv:${id}`;
  const cached = cacheGet(key);
  if (cached !== null) return cached === "null" ? null : (JSON.parse(cached) as OsvSummary);
  const base = await getJson(`${OSV_API}/${encodeURIComponent(id)}`);
  const aliases = base ? osvAliases(base) : [];
  const extra = await Promise.all(
    aliases.map((alias) => getJson(`${OSV_API}/${encodeURIComponent(alias)}`).catch(() => null)),
  );
  const summary = summarizeOsv(id, [base, ...extra]);
  cacheSet(key, "json", summary ? JSON.stringify(summary) : "null", OSV_TTL);
  return summary;
}
