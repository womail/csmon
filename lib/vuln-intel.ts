/** FIRST EPSS: probability (0–1) a CVE is exploited in the next 30 days, plus its percentile. */
export type EpssScore = {
  cve: string;
  epss: number;
  percentile: number;
  date: string;
};

export const EPSS_API = "https://api.first.org/data/v1/epss";
export const OSV_API = "https://api.osv.dev/v1/vulns";

export function parseEpssResponse(body: unknown): EpssScore[] {
  const data = (body as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  const out: EpssScore[] = [];
  for (const row of data as Record<string, unknown>[]) {
    const cve = typeof row.cve === "string" ? row.cve.toUpperCase() : "";
    const epss = Number(row.epss);
    const percentile = Number(row.percentile);
    if (!cve || !Number.isFinite(epss)) continue;
    out.push({
      cve,
      epss,
      percentile: Number.isFinite(percentile) ? percentile : 0,
      date: typeof row.date === "string" ? row.date : "",
    });
  }
  return out;
}

export function epssLabel(score: EpssScore) {
  const pct = score.epss * 100;
  return `EPSS ${pct >= 10 ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

/** Colour band by exploit probability: ≥10% hot, ≥1% warm. */
export function epssTone(score: EpssScore): "hot" | "warm" | "cool" {
  if (score.epss >= 0.1) return "hot";
  if (score.epss >= 0.01) return "warm";
  return "cool";
}

/** One open-source package an OSV record says is affected, with the versions that fix it. */
export type OsvPackage = {
  ecosystem: string;
  name: string;
  fixed: string[];
  lastAffected: string[];
};

export type OsvSummary = {
  cve: string;
  /** Advisory ids consulted (CVE record plus GHSA aliases). */
  ids: string[];
  summary: string | null;
  severity: string | null;
  packages: OsvPackage[];
  references: string[];
};

type OsvRecord = {
  id?: string;
  summary?: string;
  aliases?: string[];
  database_specific?: { severity?: string };
  affected?: {
    package?: { ecosystem?: string; name?: string };
    ranges?: { type?: string; events?: Record<string, string>[] }[];
  }[];
  references?: { type?: string; url?: string }[];
};

/** Fold one or more OSV records (CVE + GHSA) into package → fixed-version rows. */
export function summarizeOsv(cve: string, records: unknown[]): OsvSummary | null {
  const rows = records.filter(Boolean) as OsvRecord[];
  if (!rows.length) return null;
  const packages = new Map<string, OsvPackage>();
  const references = new Set<string>();
  let summary: string | null = null;
  let severity: string | null = null;
  for (const record of rows) {
    summary ??= record.summary?.trim() || null;
    severity ??= record.database_specific?.severity ?? null;
    for (const ref of record.references ?? []) {
      if (ref.url && (ref.type === "FIX" || ref.type === "ADVISORY" || ref.type === "PACKAGE")) references.add(ref.url);
    }
    for (const affected of record.affected ?? []) {
      const name = affected.package?.name;
      const ecosystem = affected.package?.ecosystem;
      if (!name || !ecosystem) continue;
      const key = `${ecosystem}:${name}`;
      const row = packages.get(key) ?? { ecosystem, name, fixed: [], lastAffected: [] };
      for (const range of affected.ranges ?? []) {
        if (range.type === "GIT") continue;
        for (const event of range.events ?? []) {
          if (event.fixed && !row.fixed.includes(event.fixed)) row.fixed.push(event.fixed);
          if (event.last_affected && !row.lastAffected.includes(event.last_affected)) {
            row.lastAffected.push(event.last_affected);
          }
        }
      }
      packages.set(key, row);
    }
  }
  const sorted = [...packages.values()]
    .filter((row) => row.fixed.length || row.lastAffected.length)
    .sort((a, b) => b.fixed.length - a.fixed.length)
    .slice(0, 12);
  return {
    cve,
    ids: rows.map((row) => row.id ?? "").filter(Boolean),
    summary,
    severity,
    packages: sorted,
    references: [...references].slice(0, 6),
  };
}

export function osvAliases(record: unknown): string[] {
  const aliases = (record as OsvRecord | null)?.aliases ?? [];
  return aliases.filter((id) => /^GHSA-/i.test(id)).slice(0, 2);
}
