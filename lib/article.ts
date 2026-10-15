export type ArticleRead = {
  url: string;
  site: string;
  title: string;
  description: string | null;
  /** When the piece was published (from page meta / JSON-LD / time), not when we fetched. */
  publishedAt: number | null;
  paragraphs: string[];
  quotes: string[];
  language: string | null;
  related: { href: string; label: string }[];
  /** CVE IDs mined from copy and NVD links on the page. */
  cveIds: string[];
  /** How the main body was extracted from HTML. */
  extractEngine?: "readability" | "cheerio";
};

const NOISE_COPY =
  /\b(we only use cookies|this (site|website) uses cookies|cookie (notice|policy|consent)|accept (all )?cookies|necessary for the technical functioning|find out more on here|subscribe to (our |the )?newsletter|download pdf\b.{0,40}\bsha-?256\b|share on facebook|share on twitter|reach out to get featured|contact us to send your exclusive|leave a comment\/feedback|ask us a question or leave)\b/i;

export function isNoiseCopy(text: string) {
  return NOISE_COPY.test(text.replace(/\s+/g, " ").trim());
}
