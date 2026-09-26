import "server-only";

import { cacheGet, cacheSet, TTL } from "./cache";
import { fetchOutbound } from "./safe-url";
import { APP_UA } from "./version";
import {
  NVD_CVE_API,
  normalizeCveId,
  parseNvdCveResponse,
  type NvdCveBrief,
} from "./nvd";

const NVD_TTL = TTL.json;

async function fetchNvdJson(cveId: string): Promise<unknown> {
  const cacheKey = `nvd:${cveId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return JSON.parse(cached) as unknown;

  const url = `${NVD_CVE_API}?cveId=${encodeURIComponent(cveId)}`;
  const res = await fetchOutbound(url, {
    headers: {
      "User-Agent": APP_UA,
      Accept: "application/json",
    },
    timeoutMs: 15000,
    maxBytes: 4_000_000,
  });
  if (!res.ok) {
    throw new Error(`NVD returned ${res.status}`);
  }
  const text = await res.text();
  cacheSet(cacheKey, "json", text, NVD_TTL);
  return JSON.parse(text) as unknown;
}

export async function fetchNvdCve(cveId: string): Promise<NvdCveBrief | null> {
  const id = normalizeCveId(cveId);
  if (!id) return null;
  try {
    const body = await fetchNvdJson(id);
    return parseNvdCveResponse(body, id);
  } catch {
    return null;
  }
}

function pause(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function fetchNvdCves(cveIds: string[], cap = 5): Promise<NvdCveBrief[]> {
  const unique = [...new Set(cveIds.map((id) => normalizeCveId(id)).filter(Boolean))] as string[];
  const out: NvdCveBrief[] = [];
  for (const [index, id] of unique.slice(0, cap).entries()) {
    if (index > 0) await pause(400);
    const row = await fetchNvdCve(id);
    if (row) out.push(row);
  }
  return out;
}
