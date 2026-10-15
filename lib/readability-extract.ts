import "server-only";

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

export type ReadabilityExtract = {
  title: string;
  excerpt: string | null;
  paragraphs: string[];
  language: string | null;
  byline: string | null;
};

function paragraphsFromText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  let parts = normalized
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 32);
  if (parts.length >= 2) return parts;
  if (normalized.length >= 120) {
    parts = normalized
      .split(/(?<=[.!?])\s+(?=[A-Z"“])/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter((p) => p.length >= 40);
  }
  if (parts.length === 0 && normalized.length >= 80) return [normalized.replace(/\s+/g, " ").trim()];
  return parts;
}

/** Mozilla Readability (Firefox Reader View) — article body without nav/ads. */
export function extractWithReadability(html: string, pageUrl: string): ReadabilityExtract | null {
  try {
    const dom = new JSDOM(html, { url: pageUrl });
    const parsed = new Readability(dom.window.document).parse();
    if (!parsed?.textContent?.trim()) return null;
    const paragraphs = paragraphsFromText(parsed.textContent);
    if (paragraphs.length === 0) return null;
    const lang =
      parsed.lang?.trim() ||
      dom.window.document.documentElement.getAttribute("lang")?.trim() ||
      null;
    return {
      title: parsed.title?.replace(/\s+/g, " ").trim() ?? "",
      excerpt: parsed.excerpt?.replace(/\s+/g, " ").trim() || null,
      paragraphs,
      language: lang,
      byline: parsed.byline?.replace(/\s+/g, " ").trim() || null,
    };
  } catch {
    return null;
  }
}
