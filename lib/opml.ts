import type { CreateSourceInput } from "./source-catalog-shared";
import { typeFromCategory, type SourceType } from "./source-types";

/** Folder name → type; an unknown folder reads as an independent blog. */
export function opmlFolderType(category: string | null): SourceType | null {
  if (!category) return null;
  return typeFromCategory(category) ?? "blog";
}

/** Subscription lists such as https://threatfilter.dev/feeds.opml stay well under this. */
export const OPML_MAX_BYTES = 1_000_000;
export const OPML_MAX_FEEDS = 400;

export type ParsedOpml = {
  title: string | null;
  layers: CreateSourceInput[];
  warnings: string[];
};

function decodeXml(text: string) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function attributes(raw: string) {
  const out: Record<string, string> = {};
  const re = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (let match = re.exec(raw); match; match = re.exec(raw)) {
    out[match[1].toLowerCase()] = decodeXml(match[2] ?? match[3] ?? "");
  }
  return out;
}

function siteForFeed(feedUrl: string, htmlUrl: string | undefined) {
  if (htmlUrl && /^https?:\/\//i.test(htmlUrl)) return htmlUrl;
  try {
    return new URL(feedUrl).origin;
  } catch {
    return "";
  }
}

/** Turn an OPML subscription list into RSS layers. Safe to run in the browser. */
export function parseOpml(xml: string): ParsedOpml {
  const warnings: string[] = [];
  if (xml.length > OPML_MAX_BYTES) {
    throw new Error("That OPML file is larger than 1 MB.");
  }
  const body = xml.replace(/<!--[\s\S]*?-->/g, "");
  if (!/<opml\b/i.test(body) && !/<outline\b/i.test(body)) {
    throw new Error("That file is not an OPML subscription list.");
  }

  const titleMatch = body.match(/<head\b[^>]*>[\s\S]*?<title>([^<]*)<\/title>/i);
  const title = titleMatch ? decodeXml(titleMatch[1]).trim() || null : null;

  const layers: CreateSourceInput[] = [];
  const seen = new Set<string>();
  const categories: string[] = [];
  const tagRe = /<(\/)?outline\b([^>]*)>/gi;

  for (let match = tagRe.exec(body); match; match = tagRe.exec(body)) {
    const closing = Boolean(match[1]);
    if (closing) {
      categories.pop();
      continue;
    }
    const raw = match[2] ?? "";
    const selfClosing = /\/\s*$/.test(raw);
    const attr = attributes(raw);
    const label = (attr.title || attr.text || "").trim();
    const feedUrl = (attr.xmlurl || "").trim();
    if (!feedUrl) {
      if (!selfClosing) categories.push(label);
      continue;
    }
    const type = (attr.type || "rss").toLowerCase();
    if (type !== "rss" && type !== "atom" && type !== "feed") {
      warnings.push(`Skipped ${label || feedUrl}: outline type “${type}” is not a feed.`);
      continue;
    }
    if (!/^https?:\/\//i.test(feedUrl)) {
      warnings.push(`Skipped ${label || feedUrl}: feed URL must be http or https.`);
      continue;
    }
    const key = feedUrl.toLowerCase();
    if (seen.has(key)) {
      warnings.push(`Skipped duplicate feed URL (${label || feedUrl}).`);
      continue;
    }
    if (layers.length >= OPML_MAX_FEEDS) {
      warnings.push(`Stopped after ${OPML_MAX_FEEDS} feeds.`);
      break;
    }
    seen.add(key);
    const category = categories.filter(Boolean).join(" › ").slice(0, 120) || null;
    let host = feedUrl;
    try {
      host = new URL(feedUrl).hostname;
    } catch {
      /* keep the raw URL as the label */
    }
    layers.push({
      name: (label || host).slice(0, 160),
      url: siteForFeed(feedUrl, attr.htmlurl),
      feedUrl,
      description: attr.description?.trim().slice(0, 240) || null,
      category,
      sourceType: opmlFolderType(category),
      enabled: true,
    });
  }

  if (!layers.length) {
    throw new Error(warnings[0] || "No RSS feeds in that OPML list.");
  }
  return { title, layers, warnings };
}
