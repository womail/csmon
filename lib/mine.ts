import type { Item, Source } from "./types";

const CVE_RE = /\bCVE-\d{4}-\d{4,7}\b/gi;
const RANSOM_RE =
  /\b(ransomware|lockbit|alphv|blackcat|cl0p|clop|akira|play ransomware|black basta|royal ransomware)\b/i;

export const VENDOR_NAMES = [
  "Microsoft",
  "Google",
  "Apple",
  "Cisco",
  "Adobe",
  "Oracle",
  "Linux",
  "Apache",
  "OpenSSL",
  "Fortinet",
  "Ivanti",
  "VMware",
  "Citrix",
  "Palo Alto",
  "Juniper",
  "Atlassian",
  "GitLab",
  "WordPress",
  "Android",
  "Chrome",
  "Firefox",
  "Windows",
  "Ubuntu",
  "Red Hat",
  "Amazon",
  "Cloudflare",
  "SonicWall",
  "Progress",
  "MOVEit",
  "SAP",
  "IBM",
  "Dell",
  "HP",
  "Qualcomm",
  "Samsung",
  "Zoom",
  "Slack",
  "Okta",
  "CrowdStrike",
  "Palo Alto Networks",
] as const;

const VENDOR_RES = VENDOR_NAMES.map((name) => ({
  name,
  re: new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
}));

export type MinedSignals = {
  cves: string[];
  vendors: string[];
  ransomware: boolean;
};

export function mineText(text: string): MinedSignals {
  const cves = [...new Set((text.match(CVE_RE) ?? []).map((cve) => cve.toUpperCase()))];
  const vendors = VENDOR_NAMES.filter((_, i) => VENDOR_RES[i].re.test(text));
  return { cves, vendors, ransomware: RANSOM_RE.test(text) };
}

export function mineItem(item: Pick<Item, "title" | "summary">): MinedSignals {
  return mineText(`${item.title} ${item.summary ?? ""}`);
}

export function isAdvisoryItem(item: Item, source?: Source) {
  if (item.topics.includes("cyber") || item.tags.includes("cyber")) return true;
  if (source?.origins.some((origin) => origin.reason === "intel") && source.handle) {
    const securityIds = new Set([
      "cisa",
      "bellingcat",
      "cfr",
      "krebs",
      "bleeping",
      "therecord",
      "ncsc",
      "schneier",
      "msrc",
      "cisa-ics",
      "hacker-news",
      "darkreading",
      "cert-eu",
    ]);
    if (securityIds.has(source.handle)) return true;
  }
  const mined = mineItem(item);
  return mined.cves.length > 0 || mined.ransomware;
}
