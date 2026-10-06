import type { ArticleRead } from "./article";
import type { KevEntry } from "./kev";
import { mineItem } from "./mine";
import type { Item } from "./types";

/** CVE IDs mentioned in RSS title/summary (board copy), not page extract sidebars. */
export function feedCvesForItem(item: Pick<Item, "title" | "summary">) {
  return mineItem(item).cves.map((cve) => cve.toUpperCase());
}

/** CVEs eligible for NVD / vuln panels for the active reader item. */
export function readerNvdCves(
  active: Pick<Item, "title" | "summary">,
  article: ArticleRead | null,
  kevHits: KevEntry[],
) {
  const feed = new Set(feedCvesForItem(active));
  const ids = new Set<string>(feed);
  for (const cve of article?.cveIds ?? []) {
    const key = cve.toUpperCase();
    if (feed.has(key)) ids.add(key);
  }
  for (const row of kevHits) {
    const key = row.cveId.toUpperCase();
    if (feed.has(key)) ids.add(key);
  }
  return [...ids].sort().slice(0, 5);
}

export function readerNvdCveKey(
  active: Pick<Item, "title" | "summary">,
  article: ArticleRead | null,
  kevHits: KevEntry[],
) {
  return readerNvdCves(active, article, kevHits).join(",");
}
