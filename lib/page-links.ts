import { isNoiseCopy } from "./article";

const AD_LABEL =
  /\b(share on facebook|share on twitter|share on linkedin|follow us on|subscribe to|sign up for|reach out to get featured|contact us to send|leave a comment\/feedback|exclusive story idea|get featured|advertisement|sponsored content|promoted content)\b/i;

const AD_HOST =
  /(^|\.)((facebook|twitter|x|linkedin|instagram|tiktok|pinterest|reddit)\.com|addthis\.com|sharethis\.com)/i;

const VENDOR_ADVISORY_HOST =
  /(^|\.)((support|download|docs|learn|help)\.)?(citrix|microsoft|adobe|cisco|fortinet|vmware|ivanti|paloaltonetworks|netapp)\.com|cert\.europa\.eu|cisa\.gov|nist\.gov/i;

const JUNK_LABEL =
  /^(read more|click here|here|more|→|»|›|\d+\s*comments?|login|sign in)$/i;

export function isPageLinkNoise(label: string, href: string) {
  const text = label.replace(/\s+/g, " ").trim();
  if (text.length < 4) return true;
  if (JUNK_LABEL.test(text)) return true;
  if (isNoiseCopy(text)) return true;
  if (AD_LABEL.test(text)) return true;
  try {
    const host = new URL(href).hostname;
    if (AD_HOST.test(host)) return true;
  } catch {
    return true;
  }
  return false;
}

export function isVendorAdvisoryLink(href: string) {
  try {
    const host = new URL(href).hostname.toLowerCase();
    return VENDOR_ADVISORY_HOST.test(host);
  } catch {
    return false;
  }
}

export function filterArticlePageLinks(links: { href: string; label: string }[], pageUrl: string) {
  let pageHost = "";
  try {
    pageHost = new URL(pageUrl).hostname.replace(/^www\./, "");
  } catch {
    /* ignore */
  }
  const out: { href: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    if (!/^https?:/i.test(link.href)) continue;
    if (isPageLinkNoise(link.label, link.href)) continue;
    let host = "";
    try {
      host = new URL(link.href).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    if (host === pageHost && link.label.length < 24) continue;
    const label =
      link.label.length > 8
        ? link.label
        : host + new URL(link.href).pathname.replace(/\/$/, "").slice(0, 80);
    if (isPageLinkNoise(label, link.href)) continue;
    if (seen.has(link.href)) continue;
    seen.add(link.href);
    out.push({ href: link.href, label: label.slice(0, 200) });
  }
  return out.slice(0, 12);
}
