import "server-only";

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { reflowProse } from "./prose";

export type ReadabilityExtract = {
  title: string;
  excerpt: string | null;
  paragraphs: string[];
  language: string | null;
  byline: string | null;
};

function paragraphsFromText(text: string): string[] {
  return reflowProse(text).filter((part) => part.length >= 40 || (part.length >= 12 && !/[.!?…]$/.test(part)));
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
