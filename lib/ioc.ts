/** Threat indicators only — not vendor/CERT reference URLs. */

export type IocKind = "ipv4" | "domain" | "sha256" | "sha1" | "md5";

export type IocHit = {
  kind: IocKind;
  value: string;
  context?: string;
};

const SHA256_RE = /\b[a-fA-F0-9]{64}\b/g;
const SHA1_RE = /\b[a-fA-F0-9]{40}\b/g;
const MD5_RE = /\b[a-fA-F0-9]{32}\b/g;
const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\b/g;

/** Lines that suggest the following token is a threat indicator, not a citation. */
const THREAT_LINE =
  /\b(ioc|iocs|indicator of compromise|indicators of compromise|c2|c&c|command and control|beacon|malicious domain|malware host|sinkhole|blocklist|threat actor|exfil|botnet|payload hosted|downloads? from|resolves to|communicates with|hard-coded|hardcoded)\b/i;

const DOMAIN_IN_LINE =
  /\b([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|xyz|ru|cn|top|shop|biz|info|me|co|uk|de|fr|eu|app|dev|cloud)\b/gi;

const REFERENCE_HOST_SUFFIX =
  /(?:\.gov|\.europa\.eu|\.nist\.gov|cisa\.gov|cert\.|support\.|download\.|docs\.|learn\.|www\.microsoft\.com|adobe\.com|citrix\.com|fortinet\.com|cisco\.com)/i;

function normHost(raw: string) {
  try {
    if (raw.includes("://")) return new URL(raw).hostname.toLowerCase();
  } catch {
    /* ignore */
  }
  return raw.replace(/^\*\./, "").toLowerCase().replace(/[),.;]+$/, "");
}

function isPrivateOrBogusIp(ip: string) {
  if (ip.startsWith("127.") || ip.startsWith("0.") || ip === "255.255.255.255") return true;
  const parts = ip.split(".").map(Number);
  if (parts[0] === 10) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
}

function snippetAround(text: string, index: number, value: string) {
  const start = Math.max(0, index - 56);
  const end = Math.min(text.length, index + value.length + 56);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function collectReferenceHosts(urls: string[]): Set<string> {
  const out = new Set<string>();
  for (const raw of urls) {
    const h = normHost(raw);
    if (h) out.add(h);
    out.add(h.replace(/^www\./, ""));
  }
  return out;
}

function hostExcluded(host: string, exclude: Set<string>) {
  const h = normHost(host);
  if (!h) return true;
  if (exclude.has(h) || exclude.has(h.replace(/^www\./, ""))) return true;
  if (REFERENCE_HOST_SUFFIX.test(h)) return true;
  return false;
}

/** Domains only on lines with explicit threat/IOC language — not bare advisory citations. */
function mineThreatDomains(text: string, exclude: Set<string>): IocHit[] {
  const out: IocHit[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\n+/);
  for (const line of lines) {
    if (!THREAT_LINE.test(line)) continue;
    for (const match of line.matchAll(DOMAIN_IN_LINE)) {
      const host = match[0].toLowerCase();
      if (hostExcluded(host, exclude)) continue;
      const key = `domain:${host}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        kind: "domain",
        value: host,
        context: line.replace(/\s+/g, " ").trim().slice(0, 160),
      });
    }
  }
  return out;
}

export function mineThreatIocs(
  text: string,
  options?: { excludeHosts?: string[]; limit?: number },
): IocHit[] {
  const exclude = collectReferenceHosts(options?.excludeHosts ?? []);
  const limit = options?.limit ?? 20;
  const seen = new Set<string>();
  const out: IocHit[] = [];

  function push(hit: IocHit) {
    const key = `${hit.kind}:${hit.value.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(hit);
  }

  for (const match of text.matchAll(SHA256_RE)) {
    push({
      kind: "sha256",
      value: match[0].toLowerCase(),
      context: snippetAround(text, match.index ?? 0, match[0]),
    });
  }
  for (const match of text.matchAll(SHA1_RE)) {
    const v = match[0].toLowerCase();
    if (seen.has(`sha256:${v}`)) continue;
    push({ kind: "sha1", value: v, context: snippetAround(text, match.index ?? 0, match[0]) });
  }
  for (const match of text.matchAll(MD5_RE)) {
    push({ kind: "md5", value: match[0].toLowerCase(), context: snippetAround(text, match.index ?? 0, match[0]) });
  }
  for (const match of text.matchAll(IPV4_RE)) {
    const ip = match[0];
    if (isPrivateOrBogusIp(ip)) continue;
    const ctx = snippetAround(text, match.index ?? 0, ip);
    if (!THREAT_LINE.test(ctx) && !/\b(ioc|hash|malware|botnet|c2)\b/i.test(ctx)) continue;
    push({ kind: "ipv4", value: ip, context: ctx });
  }

  for (const row of mineThreatDomains(text, exclude)) {
    push(row);
  }

  return out.slice(0, limit);
}

export function iocBlockHints(hits: IocHit[]): string[] {
  if (!hits.length) {
    return [
      "No threat IOCs in this extract — advisory links (CERT, vendor support) are not block targets.",
      "Use patch/mitigation links above; hunt only if your TI feeds or logs show overlap.",
    ];
  }
  const hints: string[] = [];
  const ips = hits.filter((h) => h.kind === "ipv4");
  const domains = hits.filter((h) => h.kind === "domain");
  const hashes = hits.filter((h) => h.kind !== "ipv4" && h.kind !== "domain");
  if (hashes.length) {
    hints.push(`EDR: hunt ${hashes.length} hash(es) from threat-context lines; confirm prevalence before mass quarantine.`);
  }
  if (domains.length) {
    hints.push(`DNS/proxy: review ${domains.length} domain(s) flagged in IOC context — correlate with DNS/firewall logs before deny rules.`);
  }
  if (ips.length) {
    hints.push(`Network: ${ips.length} IP(s) in threat context — block only after telemetry match, not from RSS alone.`);
  }
  return hints;
}

/** @deprecated use mineThreatIocs */
export function mineIocs(text: string, limit = 24): IocHit[] {
  return mineThreatIocs(text, { limit });
}
