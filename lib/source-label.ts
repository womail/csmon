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
  [/^cert-fr\b/i, "CERT-FR"],
  [/^the record\b/i, "The Record"],
];

/** Keep a long name whole up to `max`, then stop after a word. */
function clipAtWord(value: string, max: number) {
  if (value.length <= max) return value;
  const slice = value.slice(0, max + 1);
  const space = slice.lastIndexOf(" ");
  const word = (space > 10 ? slice.slice(0, space) : (value.split(" ")[0] ?? value)).trim();
  return word.length < value.length ? `${word}…` : word;
}

export function shortSourceName(name: string) {
  const trimmed = name.replace(/\s+/g, " ").trim();
  if (!trimmed) return "source";
  for (const [re, label] of ALIASES) {
    if (re.test(trimmed)) return label;
  }
  const head = (trimmed.split(/\s+[–—|:]\s+/)[0] ?? trimmed).replace(/\s+rss$/i, "").trim();
  return clipAtWord(head, 36);
}
