import type { Item } from "./types";

const DOC_RE =
  /\b(report|whitepaper|white paper|pdf|briefing|advisory|analysis|assessment|testimony|hearing|gazette|doctrine)\b/i;
const DOC_URL_RE = /\.(pdf|docx?|pptx?|odt)(?:$|\?)/i;

export type DocumentLink = {
  href: string;
  label: string;
  kind: "pdf" | "report" | "advisory" | "page";
};

export function isDocumentItem(item: Pick<Item, "title" | "summary" | "url" | "topics" | "tags">) {
  if (DOC_URL_RE.test(item.url)) return true;
  if (item.topics.includes("cyber") && /\b(advisory|cve-|kev)\b/i.test(item.title)) return true;
  return DOC_RE.test(`${item.title} ${item.summary ?? ""}`);
}

export function documentKind(url: string, title: string): DocumentLink["kind"] {
  if (DOC_URL_RE.test(url) || /\bpdf\b/i.test(title)) return "pdf";
  if (/\badvisory|cve-|kev\b/i.test(title)) return "advisory";
  if (DOC_RE.test(title)) return "report";
  return "page";
}

export function documentsFromItems(items: Item[]): DocumentLink[] {
  return items
    .filter((item) => isDocumentItem(item))
    .map((item) => ({
      href: item.url,
      label: item.title,
      kind: documentKind(item.url, item.title),
    }));
}

export function relatedDocuments(links: { href: string; label: string }[]): DocumentLink[] {
  return links
    .filter((link) => DOC_URL_RE.test(link.href) || DOC_RE.test(link.label))
    .map((link) => ({
      href: link.href,
      label: link.label,
      kind: documentKind(link.href, link.label),
    }));
}
