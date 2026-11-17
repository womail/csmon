import { isNoiseCopy } from "./article";
import { reflowProse } from "./prose";

export type ArticleBlock =
  | { kind: "heading"; text: string }
  | { kind: "kicker"; text: string }
  | { kind: "callout"; text: string }
  | { kind: "cve"; cveId: string; cvss: string | null; detail: string }
  | { kind: "list"; title: string | null; items: string[] }
  | { kind: "reference"; index: string; href: string; label: string }
  | { kind: "meta"; text: string }
  | { kind: "paragraph"; text: string };

const CVE_LINE =
  /^The vulnerability (CVE-\d{4}-\d{4,7})(?:\s*\(CVSS:\s*([\d.]+)\))?\s+is\s+(.+)/i;
const CVE_REQUIRES =
  /^The vulnerability (CVE-\d{4}-\d{4,7})(?:\s*\(CVSS:\s*([\d.]+)\))?\s+requires\s+(.+)/i;
const CVE_INLINE = /\b(CVE-\d{4}-\d{4,7})\b/gi;
const AFFECTED_INTRO =
  /^The following .+(?:are )?affected|^Affected versions|^The following supported versions/i;
const VERSION_ITEM =
  /^(?:NetScaler|Citrix|version \d|[A-Z][a-z]+ (?:ADC|Gateway|FIPS)|\d+\.\d|before \d|FIPS)/i;
const META_LINE =
  /^\d{4}-\d{3}:|^\d{2}\/\d{2}\/\d{4}\s*---|^v\d+\.\d+\s*--\s*Initial publication/i;
const FOOTNOTE = /^\[(\d+)\]\s*(https?:\/\/\S+)/;
const SHORT_HEADING = /^Critical Vulnerabilities in .+/i;

function norm(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function foldKey(text: string) {
  return norm(text).slice(0, 120);
}

/** Drop RSS/page duplicates and near-substring repeats before display. */
export function cleanArticleParagraphs(
  title: string,
  description: string | null,
  paragraphs: string[],
): string[] {
  const titleKey = foldKey(title);
  const descKey = description ? foldKey(description) : "";
  let rows = paragraphs
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 24 && !isNoiseCopy(p));

  const seen = new Set<string>();
  rows = rows.filter((p) => {
    const key = foldKey(p);
    if (key === titleKey || (descKey && key === descKey)) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  rows.sort((a, b) => b.length - a.length);
  const kept: string[] = [];
  for (const row of rows) {
    const key = norm(row);
    if (kept.some((other) => norm(other).includes(key) && other.length > row.length + 20)) {
      continue;
    }
    kept.push(row);
  }
  kept.sort((a, b) => paragraphs.indexOf(a) - paragraphs.indexOf(b));
  return kept.slice(0, 24);
}

function parseReference(line: string, related: { href: string; label: string }[]) {
  const foot = line.match(FOOTNOTE);
  if (foot) {
    return {
      index: foot[1],
      href: foot[2],
      label: foot[2].replace(/^https?:\/\//, ""),
    };
  }
  const bracket = line.match(/\[(\d+)\]/);
  if (bracket && related.length) {
    const href = related[Number(bracket[1]) - 1]?.href ?? related[0]?.href;
    if (href) {
      return {
        index: bracket[1],
        href,
        label: href.replace(/^https?:\/\//, ""),
      };
    }
  }
  return null;
}

export function paragraphsToBlocks(
  paragraphs: string[],
  options?: { title?: string; related?: { href: string; label: string }[] },
): ArticleBlock[] {
  const related = options?.related ?? [];
  const title = options?.title?.trim() ?? "";
  const blocks: ArticleBlock[] = [];
  let listBuffer: string[] = [];
  let listTitle: string | null = null;

  function flushList() {
    if (!listBuffer.length) return;
    blocks.push({ kind: "list", title: listTitle, items: listBuffer });
    listBuffer = [];
    listTitle = null;
  }

  for (const raw of paragraphs) {
    for (const line of reflowProse(raw)) {
    if (!line) continue;

    const ref = parseReference(line, related);
    if (ref) {
      flushList();
      blocks.push({ kind: "reference", ...ref });
      continue;
    }

    if (META_LINE.test(line)) {
      flushList();
      blocks.push({ kind: "meta", text: line });
      continue;
    }

    const cveMatch = line.match(CVE_LINE) ?? line.match(CVE_REQUIRES);
    if (cveMatch) {
      flushList();
      const detail = cveMatch[3].trim();
      blocks.push({
        kind: "cve",
        cveId: cveMatch[1].toUpperCase(),
        cvss: cveMatch[2] ?? null,
        detail: line.match(CVE_REQUIRES) ? `Requires ${detail}` : detail,
      });
      continue;
    }

    if (/CERT-EU recommends/i.test(line)) {
      flushList();
      blocks.push({ kind: "callout", text: line });
      continue;
    }

    if (AFFECTED_INTRO.test(line)) {
      flushList();
      listTitle = line;
      continue;
    }

    if (VERSION_ITEM.test(line) || /\bbefore \d+\.\d/i.test(line)) {
      listBuffer.push(line);
      continue;
    }

    if (title && norm(line) === norm(title)) continue;
    if (SHORT_HEADING.test(line) && blocks.some((b) => b.kind === "heading")) continue;

    if (isByline(line) || isLeadLabel(line, blocks)) {
      flushList();
      blocks.push({ kind: "kicker", text: line });
      continue;
    }

    if (line.length < 100 && /^[A-Z0-9][^.!?]*[a-z)]$/.test(line) && !line.includes(" vulnerability ")) {
      flushList();
      blocks.push({ kind: "heading", text: line });
      continue;
    }

    flushList();
    blocks.push({ kind: "paragraph", text: line });
    }
  }
  flushList();
  return blocks;
}

function isByline(line: string) {
  return (
    line.length < 100 &&
    line.split(/\s+/).length <= 8 &&
    /\b(reporter|correspondent|columnist|editor|writer)\b/i.test(line)
  );
}

/** Outlet line or section tags at the top of a piece, before the body starts. */
function isLeadLabel(line: string, blocks: ArticleBlock[]) {
  if (blocks.some((block) => block.kind === "paragraph" || block.kind === "heading")) return false;
  if (blocks.length > 1) return false;
  if (line.length > 90 || /[.!?]$/.test(line)) return false;
  if (/^(who|what|when|where|why|how)\b/i.test(line)) return false;
  const words = line.split(/\s+/);
  return words.length >= 2 && words.length <= 8;
}

/** Re-split a stored paragraph that was saved as one glued block. */
export function presentArticleBlocks(blocks: ArticleBlock[]): ArticleBlock[] {
  const out: ArticleBlock[] = [];
  for (const block of blocks) {
    if (block.kind !== "paragraph") {
      out.push(block);
      continue;
    }
    const parts = reflowProse(block.text);
    if (parts.length <= 1) {
      out.push(parts[0] ? { ...block, text: parts[0] } : block);
      continue;
    }
    out.push(...paragraphsToBlocks(parts));
  }
  return out;
}

export function articleDisplayBlocks(
  title: string,
  description: string | null,
  paragraphs: string[],
  related: { href: string; label: string }[],
): ArticleBlock[] {
  const expanded = paragraphs.flatMap((paragraph) => reflowProse(paragraph));
  const clean = cleanArticleParagraphs(title, description, expanded);
  const blocks = paragraphsToBlocks(clean, { title, related });
  const descText = description?.replace(/\s+/g, " ").trim() ?? "";
  if (descText && !clean.some((p) => foldKey(p) === foldKey(descText))) {
    blocks.unshift({ kind: "callout", text: descText });
  }
  const deduped: ArticleBlock[] = [];
  for (const block of blocks) {
    if (block.kind === "callout" && deduped.some((b) => b.kind === "callout" && norm(b.text).includes(norm(block.text).slice(0, 48)))) {
      continue;
    }
    deduped.push(block);
  }
  return deduped;
}

export function blocksPlainText(blocks: ArticleBlock[]): string[] {
  const out: string[] = [];
  for (const block of blocks) {
    if (block.kind === "list") {
      if (block.title) out.push(block.title);
      out.push(...block.items);
    } else if (block.kind === "cve") {
      out.push(`The vulnerability ${block.cveId} is ${block.detail}`);
    } else if (block.kind === "reference") {
      out.push(block.label);
    } else {
      out.push(block.text);
    }
  }
  return out;
}

export const URL_INLINE = /https?:\/\/[^\s\]>'",<>]+/gi;

export function splitCveSegments(text: string): { text: string; cve?: string }[] {
  const parts: { text: string; cve?: string }[] = [];
  let last = 0;
  for (const match of text.matchAll(CVE_INLINE)) {
    const idx = match.index ?? 0;
    if (idx > last) parts.push({ text: text.slice(last, idx) });
    parts.push({ text: match[0], cve: match[0].toUpperCase() });
    last = idx + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts.length ? parts : [{ text }];
}

export type InlineSegment =
  | { kind: "text"; text: string }
  | { kind: "cve"; cve: string }
  | { kind: "url"; url: string };

function trimUrlTrailing(url: string) {
  return url.replace(/[).,;]+$/, "");
}

/** Split paragraph copy into plain text, CVE tokens, and clickable URLs. */
export function splitInlineSegments(text: string): InlineSegment[] {
  const out: InlineSegment[] = [];
  for (const cvePart of splitCveSegments(text)) {
    if (cvePart.cve) {
      out.push({ kind: "cve", cve: cvePart.cve });
      continue;
    }
    const chunk = cvePart.text;
    if (!chunk) continue;
    let last = 0;
    for (const match of chunk.matchAll(URL_INLINE)) {
      const idx = match.index ?? 0;
      if (idx > last) out.push({ kind: "text", text: chunk.slice(last, idx) });
      const href = trimUrlTrailing(match[0]);
      out.push({ kind: "url", url: href });
      last = idx + match[0].length;
    }
    if (last < chunk.length) out.push({ kind: "text", text: chunk.slice(last) });
  }
  return out.length ? out : [{ kind: "text", text }];
}
