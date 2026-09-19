import "server-only";

import { cacheGet, cacheSet, TTL } from "./cache";
import { UA } from "./http";
import { KEV_URL, toKevEntry, type KevEntry, type RawKev } from "./kev";

export async function fetchKevCatalog(): Promise<KevEntry[]> {
  const cached = cacheGet("kev:catalog");
  const raw = cached
    ? (JSON.parse(cached) as RawKev)
    : await (async () => {
        const res = await fetch(KEV_URL, {
          headers: { "User-Agent": UA, Accept: "application/json" },
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) throw new Error(`KEV ${res.status}`);
        const text = await res.text();
        cacheSet("kev:catalog", "kev", text, TTL.kev);
        return JSON.parse(text) as RawKev;
      })();
  return (raw.vulnerabilities ?? []).map(toKevEntry);
}
