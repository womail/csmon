/** Normalize imperfect RSS/Atom before xml2js (unescaped &, HTML mistaken for feeds). */

export function looksLikeHtml(xml: string): boolean {
  const head = xml.trimStart().slice(0, 800).toLowerCase();
  if (/^<!doctype\s+html/.test(head)) return true;
  if (/^<\?xml/.test(head)) return false;
  return /^<html[\s>]/.test(head);
}

/** Escape bare ampersands so xml2js does not throw on publisher markup (e.g. GTM snippets in bad redirects). */
export function escapeBareAmpersands(xml: string): string {
  return xml.replace(/&(?!(?:#(?:x[0-9a-fA-F]+|[0-9]+)|[a-zA-Z][a-zA-Z0-9]*);)/g, "&amp;");
}

export function prepareRssXml(raw: string): string {
  if (!raw.trim()) throw new Error("Empty RSS response");
  if (looksLikeHtml(raw)) {
    throw new Error("Not RSS (upstream returned HTML — check feed URL or redirects)");
  }
  return escapeBareAmpersands(raw);
}
