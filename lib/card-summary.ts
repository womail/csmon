/**
 * One spoken sentence for a card. Product headers, bare URLs, title echoes,
 * and zero-casualty boilerplate stay off the board.
 */

const WMO_HEAD = /^(?:\d{3}\s+)?[A-Z]{4}\d{2}\s+[A-Z]{4}\s+\d{6}(?:\s+[A-Z0-9]{3,})?\s+/;
const MASTHEAD =
  /^(?:tropical weather outlook|public advisory|forecast discussion|special weather statement)\b[^:]{0,220}:\s*/i;
const SPOKEN =
  /\b(?:is|are|was|were|be|been|has|have|had|will|would|can|could|may|might|expected|issued|caused|hit|hits|flooded|killed|reported|said|says|moved|remains|remain|warned|struck|left|brings|brought|continues|continued|reached|reaches|closed|opened|evacuated|displaced|formed|forming|moving|moves)\b/i;
const ZERO_TOLL =
  /\b0\s+(?:deaths?|dead|fatalities|displaced|injured|missing|casualties)\b/i;
const REAL_TOLL =
  /\b[1-9]\d*\s+(?:deaths?|dead|fatalities|displaced|injured|missing|casualties)\b/i;
const COPYRIGHT = /\b(?:all rights reserved|copyright|©)\b/i;
const URL_ONLY = /^(?:https?:\/\/|www\.)\S+$/i;

function norm(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function clipSentence(value: string, max: number) {
  if (value.length <= max) return value;
  const slice = value.slice(0, max);
  const space = slice.lastIndexOf(" ");
  const word = (space > 40 ? slice.slice(0, space) : slice).trim();
  return `${word}…`;
}

function acceptable(sentence: string, title: string) {
  const text = sentence.replace(/\s+/g, " ").trim();
  if (text.length < 24) return false;
  if (URL_ONLY.test(text)) return false;
  if (COPYRIGHT.test(text)) return false;
  if (!/[a-z]/.test(text)) return false;
  if (ZERO_TOLL.test(text) && !REAL_TOLL.test(text) && text.length < 140) return false;
  const titleNorm = norm(title);
  const sentenceNorm = norm(text);
  if (!sentenceNorm || sentenceNorm === titleNorm) return false;
  if (titleNorm && sentenceNorm.startsWith(titleNorm) && text.length < title.length + 16) return false;
  const withoutUrl = text.replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
  if (withoutUrl.length < 24) return false;
  return true;
}

/** A sentence a person would say, or null when the feed text is not one. */
export function displaySummary(title: string, summary: string | null | undefined): string | null {
  if (!summary) return null;
  let text = summary.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  text = text.replace(WMO_HEAD, "").replace(MASTHEAD, "").replace(/\s+\$\$[\s\S]*$/, "").replace(/\s+NNNN[\s\S]*$/, "").trim();
  if (!text) return null;
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z“"])/);
  const spoken: string[] = [];
  for (const part of parts) {
    const sentence = part.trim();
    if (!acceptable(sentence, title) || !SPOKEN.test(sentence)) continue;
    spoken.push(sentence.replace(/\s+/g, " ").trim());
  }
  const pick = spoken[0];
  return pick ? clipSentence(pick, 220) : null;
}
