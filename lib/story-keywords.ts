const STOP = new Set(
  `about above after again against among amid around because before being below between could during
  every first from have having into just last latest more most much news next other over report reports
  said says should since some still than that their them then there these they this those through today
  under until update updates very what when where which while with within without would year years your
  live watch video photos breaking`
    .split(/\s+/)
    .filter(Boolean),
);

/** Distinctive title words, longest first, for "find other coverage" and story watches. */
export function titleKeywords(title: string, limit = 3): string[] {
  const words = title
    .replace(/[’']s\b/g, "")
    .split(/[^\p{L}\p{N}-]+/u)
    .map((word) => word.replace(/^-+|-+$/g, ""))
    .filter((word) => word.length >= 4 && !STOP.has(word.toLowerCase()) && !/^\d+$/.test(word));
  const seen = new Set<string>();
  const unique = words.filter((word) => {
    const key = word.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const capitalised = unique.filter((word) => /^\p{Lu}/u.test(word));
  const pool = capitalised.length >= limit ? capitalised : [...capitalised, ...unique.filter((w) => !capitalised.includes(w))];
  return pool.sort((a, b) => b.length - a.length).slice(0, limit);
}

/** Typed search line that ANDs the keywords (`text:` rules), or a CVE when the story names one. */
export function storySearchLine(title: string, cves: string[] = []): string {
  if (cves.length) return `cve:${cves[0]}`;
  return titleKeywords(title)
    .map((word) => `text:${word.toLowerCase()}`)
    .join(" ");
}
