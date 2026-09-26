export const CVE_ID_RE = /\bCVE-\d{4}-\d{4,7}\b/gi;

export const NVD_CVE_API = "https://services.nvd.nist.gov/rest/json/cves/2.0";

export type NvdReference = {
  url: string;
  tags: string[];
};

export type NvdActionKind = "patch" | "mitigate" | "monitor";

export type NvdCveBrief = {
  cveId: string;
  status: string;
  description: string;
  cvssScore: number | null;
  severity: string | null;
  patchAvailable: boolean;
  mitigationAvailable: boolean;
  actionKind: NvdActionKind;
  fixedVersions: string[];
  vendors: string[];
  products: string[];
  cwes: string[];
  mitigations: NvdReference[];
  patches: NvdReference[];
  releaseNotes: NvdReference[];
  vendorAdvisories: NvdReference[];
  otherReferences: NvdReference[];
  cisaRequiredAction: string | null;
  url: string;
};

export function nvdLinkLabel(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const parts = u.pathname.split("/").filter(Boolean);
    const tail = parts.slice(-2).join("/");
    if (tail && tail.length < 48) return `${host} · ${tail}`;
    if (parts.length) return `${host} · …/${parts[parts.length - 1]}`;
    return host;
  } catch {
    return url.length > 56 ? `${url.slice(0, 52)}…` : url;
  }
}

export function normalizeCveId(raw: string): string | null {
  const match = raw.trim().match(/\b(CVE-\d{4}-\d{4,7})\b/i);
  return match ? match[1].toUpperCase() : null;
}

export function cveIdsFromText(...parts: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const match of part.matchAll(CVE_ID_RE)) {
      const id = normalizeCveId(match[0]);
      if (id) set.add(id);
    }
  }
  return [...set];
}

export function cveIdsFromNvdLinks(links: { href: string }[]): string[] {
  const set = new Set<string>();
  for (const link of links) {
    try {
      const url = new URL(link.href);
      if (!url.hostname.endsWith("nist.gov")) continue;
      const m = url.pathname.match(/\/vuln\/detail\/(CVE-\d{4}-\d{4,7})/i);
      if (m) {
        const id = normalizeCveId(m[1]);
        if (id) set.add(id);
      }
    } catch {
      /* ignore */
    }
  }
  return [...set];
}

type RawVersion = {
  version?: string;
  lessThan?: string;
  status?: string;
  changes?: { at?: string; status?: string }[];
};

type RawCve = {
  id?: string;
  vulnStatus?: string;
  descriptions?: { lang?: string; value?: string }[];
  metrics?: {
    cvssMetricV31?: { cvssData?: { baseScore?: number; baseSeverity?: string } }[];
    cvssMetricV30?: { cvssData?: { baseScore?: number; baseSeverity?: string } }[];
  };
  cisaRequiredAction?: string;
  affected?: {
    affectedData?: {
      vendor?: string;
      product?: string;
      versions?: RawVersion[];
    }[];
  }[];
  references?: { url?: string; tags?: string[] }[];
  weaknesses?: { description?: { lang?: string; value?: string }[] }[];
};

function englishDescription(cve: RawCve) {
  const row =
    cve.descriptions?.find((d) => d.lang === "en") ?? cve.descriptions?.[0];
  return row?.value?.trim() ?? "";
}

function primaryCvss(cve: RawCve) {
  const row =
    cve.metrics?.cvssMetricV31?.[0]?.cvssData ??
    cve.metrics?.cvssMetricV30?.[0]?.cvssData;
  if (!row) return { score: null, severity: null };
  return {
    score: typeof row.baseScore === "number" ? row.baseScore : null,
    severity: row.baseSeverity ?? null,
  };
}

function collectFixedVersions(cve: RawCve): string[] {
  const fixes = new Set<string>();
  for (const block of cve.affected ?? []) {
    for (const data of block.affectedData ?? []) {
      const label = [data.vendor, data.product].filter(Boolean).join(" ");
      for (const v of data.versions ?? []) {
        for (const ch of v.changes ?? []) {
          if (ch.status === "unaffected" && ch.at) {
            fixes.add(label ? `${label}: ${ch.at}` : ch.at);
          }
        }
        if (v.status === "affected" && v.lessThan) {
          fixes.add(
            label
              ? `${label}: fixed in ${v.lessThan}+`
              : `Fixed in ${v.lessThan} or later`,
          );
        }
      }
    }
  }
  return [...fixes].slice(0, 10);
}

function bucketReferences(cve: RawCve) {
  const mitigations: NvdReference[] = [];
  const patches: NvdReference[] = [];
  const releaseNotes: NvdReference[] = [];
  const vendorAdvisories: NvdReference[] = [];
  const otherReferences: NvdReference[] = [];
  const seen = new Set<string>();

  for (const ref of cve.references ?? []) {
    const url = ref.url?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const tags = (ref.tags ?? []).map((t) => t.trim()).filter(Boolean);
    const row = { url, tags };
    const tagSet = new Set(tags.map((t) => t.toLowerCase()));
    if (tagSet.has("patch")) patches.push(row);
    else if (tagSet.has("mitigation")) mitigations.push(row);
    else if (tagSet.has("release notes")) releaseNotes.push(row);
    else if (tagSet.has("vendor advisory")) vendorAdvisories.push(row);
    else otherReferences.push(row);
  }

  return { mitigations, patches, releaseNotes, vendorAdvisories, otherReferences };
}

function collectVendorsProducts(cve: RawCve) {
  const vendors = new Set<string>();
  const products = new Set<string>();
  for (const block of cve.affected ?? []) {
    for (const data of block.affectedData ?? []) {
      if (data.vendor?.trim()) vendors.add(data.vendor.trim());
      if (data.product?.trim()) products.add(data.product.trim());
    }
  }
  return {
    vendors: [...vendors].slice(0, 5),
    products: [...products].slice(0, 8),
  };
}

function collectCwes(cve: RawCve): string[] {
  const set = new Set<string>();
  for (const block of cve.weaknesses ?? []) {
    for (const row of block.description ?? []) {
      const value = row.value?.trim();
      if (value && /^CWE-/i.test(value)) set.add(value.toUpperCase());
    }
  }
  return [...set].slice(0, 6);
}

function resolveActionKind(input: {
  patchAvailable: boolean;
  mitigationAvailable: boolean;
  cisaRequiredAction: string | null;
}): NvdActionKind {
  if (input.patchAvailable) return "patch";
  if (input.mitigationAvailable || input.cisaRequiredAction) return "mitigate";
  return "monitor";
}

export function parseNvdCveResponse(body: unknown, expectedId?: string): NvdCveBrief | null {
  const root = body as { vulnerabilities?: { cve?: RawCve }[] };
  const cve = root.vulnerabilities?.[0]?.cve;
  if (!cve?.id) return null;
  const cveId = normalizeCveId(cve.id);
  if (!cveId) return null;
  if (expectedId && normalizeCveId(expectedId) !== cveId) return null;

  const { score, severity } = primaryCvss(cve);
  const fixedVersions = collectFixedVersions(cve);
  const refs = bucketReferences(cve);
  const patchAvailable =
    refs.patches.length > 0 || refs.releaseNotes.length > 0 || fixedVersions.length > 0;
  const mitigationAvailable = refs.mitigations.length > 0;
  const cisaRequiredAction = cve.cisaRequiredAction?.trim() || null;
  const { vendors, products } = collectVendorsProducts(cve);

  return {
    cveId,
    status: cve.vulnStatus ?? "Unknown",
    description: englishDescription(cve),
    cvssScore: score,
    severity,
    patchAvailable,
    mitigationAvailable,
    actionKind: resolveActionKind({ patchAvailable, mitigationAvailable, cisaRequiredAction }),
    fixedVersions,
    vendors,
    products,
    cwes: collectCwes(cve),
    ...refs,
    cisaRequiredAction,
    url: `https://nvd.nist.gov/vuln/detail/${cveId}`,
  };
}
