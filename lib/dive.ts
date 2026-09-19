import { classify } from "./classify";
import type { Story } from "./cluster";
import { detectLanguage } from "./lang";
import { mineText } from "./mine";

export type ArticleSnippet = {
  title?: string;
  description?: string | null;
  paragraphs?: string[];
  quotes?: string[];
  language?: string | null;
};

export type DeepDive = {
  language: { id: string; name: string; confidence: number };
  places: string[];
  topics: string[];
  quotes: string[];
  dates: string[];
  bullets: string[];
  wordCount: number;
  readingMinutes: number;
  cves: string[];
  vendors: string[];
};

const DATE_RE =
  /\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+\d{4})?|\d{4}-\d{2}-\d{2})\b/gi;

function unique(values: string[], limit: number) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.replace(/\s+/g, " ").trim();
    if (key.length < 8) continue;
    const fold = key.toLowerCase();
    if (seen.has(fold)) continue;
    seen.add(fold);
    out.push(key);
    if (out.length >= limit) break;
  }
  return out;
}

export function buildDeepDive(story: Story, article: ArticleSnippet | null): DeepDive {
  const copy = [
    story.title,
    story.summary ?? "",
    ...story.items.map((item) => `${item.title} ${item.summary ?? ""}`),
    article?.title ?? "",
    article?.description ?? "",
    ...(article?.paragraphs ?? []),
    ...(article?.quotes ?? []),
  ].join("\n");
  const classified = classify(copy);
  const mined = mineText(copy);
  const words = copy.split(/\s+/).filter(Boolean);
  const quotes = unique(
    [...(article?.quotes ?? []), ...copy.split("\n").filter((line) => /^[“"]/.test(line.trim()))],
    6,
  );
  const bullets = unique(
    (article?.paragraphs ?? [])
      .concat(story.items.map((item) => item.summary ?? ""))
      .filter((para) => para.length > 60 && para.length < 280),
    6,
  );
  const language = detectLanguage(copy, article?.language);
  return {
    language,
    places: [...new Set([...story.locations, ...classified.locations])].slice(0, 8),
    topics: [...new Set([...story.topics, ...classified.topics])].filter((topic) => topic !== "world").slice(0, 8),
    quotes,
    dates: unique((copy.match(DATE_RE) ?? []).map((value) => value.trim()), 8),
    bullets,
    wordCount: words.length,
    readingMinutes: Math.max(1, Math.round(words.length / 220)),
    cves: mined.cves,
    vendors: mined.vendors,
  };
}
