import "server-only";

import { cacheGet, cacheSet, TTL } from "./cache";
import { fetchOutbound, readLimited } from "./safe-url";
import { UA } from "./http";
import { KEV_URL, toKevEntry, type KevEntry, type RawKev } from "./kev";

export async function fetchKevCatalog(): Promise<KevEntry[]> {
  const cached = cacheGet("kev:catalog");
  const raw = cached
    ? (JSON.parse(cached) as RawKev)
    : await (async () => {
        const res = await fetchOutbound(KEV_URL, {
          headers: { "User-Agent": UA, Accept: "application/json" },
          timeoutMs: 20000,
          maxBytes: 8_000_000,
        });
        if (!res.ok) throw new Error("KEV catalog unavailable");
        const text = await readLimited(res, 8_000_000);
        cacheSet("kev:catalog", "kev", text, TTL.kev);
        return JSON.parse(text) as RawKev;
      })();
  return (raw.vulnerabilities ?? []).map(toKevEntry);
}
