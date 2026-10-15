import { isNoiseCopy } from "./article";

/** First sentences / paragraphs for the reader “at a glance” strip (extractive, no LLM). */
export function leadBulletsFromParagraphs(paragraphs: string[], max = 3): string[] {
  const out: string[] = [];
  for (const raw of paragraphs) {
    const p = raw.replace(/\s+/g, " ").trim();
    if (p.length < 55 || p.length > 420) continue;
    if (isNoiseCopy(p)) continue;
    const line = p.length > 260 ? `${p.slice(0, 257)}…` : p;
    if (out.some((existing) => existing.slice(0, 80) === line.slice(0, 80))) continue;
    out.push(line);
    if (out.length >= max) break;
  }
  return out;
}
