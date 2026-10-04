import "server-only";

import { cacheGet, cacheSet, TTL } from "./cache";
import { fetchOutbound, readLimited } from "./safe-url";
import { APP_UA } from "./version";
import {
  CWE_API,
  cweNumericId,
  normalizeCweId,
  parseCweWeaknessResponse,
  type CweBrief,
} from "./cwe";

/** CWE catalog releases are infrequent — cache longer than NVD. */
const CWE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function fetchCweJson(ids: string[]): Promise<unknown> {
  const numeric = ids.map((id) => cweNumericId(id)).filter((id): id is string => Boolean(id));
  if (!numeric.length) return { Weaknesses: [] };
  const cacheKey = `cwe:${numeric.sort().join(",")}`;
  const cached = cacheGet(cacheKey);
  if (cached) return JSON.parse(cached) as unknown;

  const url = `${CWE_API}/${numeric.join(",")}`;
  const res = await fetchOutbound(url, {
    headers: {
      "User-Agent": APP_UA,
      Accept: "application/json",
    },
    timeoutMs: 20000,
    maxBytes: 3_000_000,
  });
  if (!res.ok) {
    throw new Error(`CWE API returned ${res.status}`);
  }
  const text = await readLimited(res, 3_000_000);
  cacheSet(cacheKey, "json", text, CWE_TTL_MS);
  return JSON.parse(text) as unknown;
}

export async function fetchCweBriefs(cweIds: string[], limit = 4): Promise<CweBrief[]> {
  const ids = [...new Set(cweIds.map(normalizeCweId).filter((id): id is string => Boolean(id)))].slice(
    0,
    limit,
  );
  if (!ids.length) return [];
  try {
    const body = await fetchCweJson(ids);
    return parseCweWeaknessResponse(body);
  } catch {
    return [];
  }
}
