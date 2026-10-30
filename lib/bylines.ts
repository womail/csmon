import type { SourceType } from "./source-types";

export type Byline = { people: string[]; outlet: string | null };

const OUTLET_WORDS = new Set([
  "news",
  "times",
  "post",
  "guide",
  "blog",
  "feed",
  "team",
  "staff",
  "desk",
  "security",
  "update",
  "center",
  "centre",
  "webmaster",
  "editor",
  "editors",
  "press",
  "media",
  "the",
  "sport",
  "sports",
  "world",
  "reuters",
  "labs",
  "advisories",
  "warnings",
  "releases",
  "report",
  "office",
  "agency",
  "service",
  "online",
  "daily",
  "weekly",
  "journal",
  "herald",
  "tribune",
  "network",
  "group",
  "inc",
  "ltd",
  "reporter",
  "correspondent",
  "writer",
  "columnist",
  "journalist",
  "analyst",
  "producer",
  "contributor",
]);

const PARTICLES = new Set(["de", "da", "del", "della", "der", "den", "van", "von", "bin", "binti", "al", "el", "la", "le", "du", "di", "dos", "das", "y", "ibn"]);

const ROLE_RE =
  /\s*(?:[-–—,|]\s*)(?:senior |chief |deputy |staff |contributing |special |political |foreign |security |technology |tech )*(?:reporter|correspondent|editor|writer|columnist|journalist|analyst|producer|contributor|bureau chief)\b.*$/i;

const TOKEN_RE = /^(?:[A-Z][\p{L}'’.-]*|[A-Z]\.|O['’][A-Z][\p{L}-]+|Mc[A-Z][\p{L}-]+|al-[A-Z][\p{L}-]+)$/u;

/** 2–4 capitalised name tokens with no digits, emoji, or outlet words. */
export function looksLikePersonName(value: string): boolean {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < 4 || text.length > 48) return false;
  if (/[\d@#/|:;()[\]{}<>!?&+=_*"“”]/.test(text)) return false;
  if (/\p{Extended_Pictographic}/u.test(text)) return false;
  const tokens = text.split(" ");
  const named = tokens.filter((token) => !PARTICLES.has(token.toLowerCase()));
  if (named.length < 2 || named.length > 4 || tokens.length > 5) return false;
  for (const token of tokens) {
    const lower = token.toLowerCase().replace(/[.'’]/g, "");
    if (OUTLET_WORDS.has(lower)) return false;
    if (PARTICLES.has(token.toLowerCase())) continue;
    if (!TOKEN_RE.test(token)) return false;
    if (token.length > 1 && token === token.toUpperCase() && !/\.$/.test(token)) return false;
  }
  return true;
}

function cleanPiece(raw: string) {
  return raw
    .replace(/^\s*(?:by|written by|words by|from)\s+/i, "")
    .replace(ROLE_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitNames(raw: string): string[] {
  const parts = cleanPiece(raw).split(/\s+(?:and|&)\s+|\s*;\s*/i).flatMap((part) => {
    const commaParts = part.split(/\s*,\s*/);
    return commaParts.length > 1 && commaParts.every((piece) => looksLikePersonName(cleanPiece(piece)))
      ? commaParts
      : [part];
  });
  return parts.map(cleanPiece).filter(Boolean);
}

const PERSONAL_TYPES = new Set<SourceType>(["outlet", "blog", "wire"]);

/**
 * Split a feed's author field into people and an outlet label.
 * `info@thehackernews.com (The Hacker News)` → outlet "The Hacker News"; `By Jane Doe and John Roe` → two people.
 */
export function parseByline(
  raw: string | null | undefined,
  source?: { name?: string | null; type?: SourceType | string | null },
): Byline {
  const text = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return { people: [], outlet: null };
  const sourceName = source?.name?.trim().toLowerCase() ?? "";

  const mail = text.match(/^\S+@\S+\s*\(([^)]+)\)$/) ?? text.match(/^([^<]+?)\s*<\S+@\S+>$/);
  if (mail) {
    const label = mail[1].trim();
    return looksLikePersonName(label) ? { people: [label], outlet: null } : { people: [], outlet: label };
  }
  if (/@/.test(text) || /^https?:|^www\./i.test(text)) return { people: [], outlet: null };
  if (sourceName && text.toLowerCase() === sourceName) return { people: [], outlet: text };

  const people = splitNames(text).filter(looksLikePersonName);
  const personal = !source?.type || PERSONAL_TYPES.has(source.type as SourceType);
  if (people.length && (personal || people.length === splitNames(text).length)) {
    return { people: [...new Set(people)].slice(0, 4), outlet: null };
  }
  return { people: [], outlet: text.slice(0, 80) };
}
