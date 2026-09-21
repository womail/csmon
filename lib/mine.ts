import type { Item, Source } from "./types";

const CVE_RE = /\bCVE-\d{4}-\d{4,7}\b/gi;
const RANSOM_RE =
  /\b(ransomware|lockbit|alphv|blackcat|cl0p|clop|akira|play ransomware|black basta|royal ransomware)\b/i;

export const VENDOR_NAMES = [
  "Microsoft",
  "Google",
  "Apple",
  "macOS",
  "Mac OS",
  "Mac",
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
  "Ubuntu",
  "CachyOS",
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

const mineCache = new WeakMap<object, MinedSignals>();

export function mineItem(item: Pick<Item, "title" | "summary">): MinedSignals {
  const cached = mineCache.get(item);
  if (cached) return cached;
  const mined = mineText(`${item.title} ${item.summary ?? ""}`);
  mineCache.set(item, mined);
  return mined;
}

export function vendorFamily(name: string) {
  const key = name.trim().toLowerCase();
  if (key === "apple" || key === "mac" || key === "macos" || key === "mac os" || key === "os x") {
    return ["Apple", "macOS", "Mac OS", "Mac"];
  }
  if (key === "microsoft" || key === "windows") return ["Microsoft", "Windows"];
  if (key === "linux" || key === "ubuntu" || key === "red hat") return ["Linux", "Ubuntu", "Red Hat"];
  return [name];
}

export function matchVendorName(name: string) {
  const key = name.trim().toLowerCase();
  if (key === "mac" || key === "macos" || key === "mac os") return "Apple";
  const hit = VENDOR_NAMES.find((vendor) => vendor.toLowerCase() === key);
  return hit ?? null;
}

export function itemHasVendor(item: Pick<Item, "title" | "summary">, vendor: string | null) {
  if (!vendor) return true;
  const aliases = vendorFamily(vendor);
  const mined = mineItem(item);
  if (mined.vendors.some((name) => aliases.some((alias) => alias.toLowerCase() === name.toLowerCase()))) {
    return true;
  }
  const hay = `${item.title} ${item.summary ?? ""}`;
  return aliases.some((alias) => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(hay);
  });
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
