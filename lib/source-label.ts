const ALIASES: [RegExp, string][] = [
  [/^the new york times en espa[nñ]ol/i, "NYT ES"],
  [/^the new york times/i, "NYT"],
  [/^al jazeera/i, "Al Jazeera"],
  [/^usgs magnitude/i, "USGS M4.5+"],
  [/^usgs significant/i, "USGS sig"],
  [/^gdacs/i, "GDACS"],
  [/^bbc news/i, "BBC"],
  [/^bbc sport/i, "BBC Sport"],
  [/^france\s*24/i, "France 24"],
  [/^world \| deutsche welle|^deutsche welle/i, "DW"],
  [/^the guardian/i, "Guardian"],
  [/^sky news/i, "Sky"],
  [/^sky sports|^skysports/i, "Sky Sport"],
  [/^associated press|\bap news\b/i, "AP"],
  [/^reuters/i, "Reuters"],
  [/^reddit/i, "Reddit"],
];

export function shortSourceName(name: string) {
  const trimmed = name.replace(/\s+/g, " ").trim();
  if (!trimmed) return "source";
  for (const [re, label] of ALIASES) {
    if (re.test(trimmed)) return label;
  }
  const head = (trimmed.split(/\s+[–—|:]\s+/)[0] ?? trimmed).replace(/\s+rss$/i, "").trim();
  if (head.length <= 22) return head;
  return `${head.slice(0, 20).trimEnd()}…`;
}
