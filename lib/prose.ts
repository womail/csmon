/**
 * Turn article text that lost its breaks (HTML tags stripped, blocks glued together)
 * back into paragraphs and section headings.
 */

const HONORIFIC =
  /^(?:rep|sen|gov|gen|lt|col|dr|mr|mrs|ms|miss|mss|prof|sgt|cpl|maj|adm|cmdr|capt|pvt|rev|hon|jr|sr|st|inc|ltd|corp|vs|etc|al|fig|vol|dept|est|approx|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)$/i;

/** Words that start a sentence, not a person's name after "Rep." or "Gen." */
const SENTENCE_START = new Set([
  "A",
  "An",
  "The",
  "This",
  "That",
  "These",
  "Those",
  "If",
  "We",
  "They",
  "He",
  "She",
  "It",
  "In",
  "On",
  "At",
  "After",
  "Before",
  "When",
  "While",
  "During",
  "Under",
  "For",
  "But",
  "And",
  "Both",
  "One",
  "Last",
  "Then",
  "There",
  "Their",
  "His",
  "Her",
  "President",
  "Secretary",
  "Director",
  "Lawmakers",
  "Democrats",
  "Republicans",
  "Officials",
  "Investigators",
  "Sources",
  "Critics",
  "House",
  "Senate",
  "What",
  "Who",
  "How",
  "Why",
  "Where",
  "Rep",
  "Sen",
  "Gov",
  "Gen",
]);

function wordBefore(text: string, index: number) {
  let i = index - 1;
  while (i >= 0 && /[A-Za-z]/.test(text[i] ?? "")) i -= 1;
  return text.slice(i + 1, index);
}

function wordAfter(text: string, index: number) {
  let i = index;
  while (i < text.length && /[A-Za-z]/.test(text[i] ?? "")) i += 1;
  return text.slice(index, i);
}

function isNameLike(word: string) {
  return /^[A-Z][a-z]{2,}$/.test(word) && !SENTENCE_START.has(word);
}

type Glue = "break" | "space";

/** Missing space after a sentence, or a missing space inside "Rep. Bennie" / "U.S. Cyber". */
function glueAfter(text: string, index: number): Glue | null {
  const next = text[index + 1] ?? "";
  if (!next || /\s/.test(next)) return null;
  let letter = next;
  let letterAt = index + 1;
  if (/[“”‘’"']/.test(next)) {
    letter = text[index + 2] ?? "";
    letterAt = index + 2;
  }
  if (!/[A-Z]/.test(letter)) return null;
  const word = wordBefore(text, index);
  if (!word) return null;
  const nextWord = wordAfter(text, letterAt);
  const nextIsInitial = text[letterAt + 1] === ".";
  if (nextIsInitial && word.length <= 2) return null;
  if (HONORIFIC.test(word)) {
    if (nextIsInitial || HONORIFIC.test(nextWord) || isNameLike(nextWord)) return "space";
    return "break";
  }
  if (word.length <= 2) {
    if (nextIsInitial) return null;
    if (isNameLike(nextWord)) return "space";
  }
  return "break";
}

function unmatchedStraightQuote(text: string) {
  return (text.match(/"/g) ?? []).length % 2 === 1;
}

function repairSentenceGlue(text: string) {
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? "";
    out += ch;
    if (ch !== "." && ch !== "!" && ch !== "?" && ch !== "…") continue;
    const glue = glueAfter(text, i);
    if (!glue) continue;
    const next = text[i + 1] ?? "";
    const closing = next === "”" || next === "’" || ((next === "\"" || next === "'") && unmatchedStraightQuote(out));
    if (closing) {
      out += next;
      i += 1;
    }
    out += glue === "break" ? "\n\n" : " ";
  }
  return out;
}

/** "cutsThompson" / "White HouseRep." — a heading ran into the next sentence. */
function splitHeadingGlue(text: string) {
  return text.replace(
    /([A-Za-z]{3,})([A-Z][a-zA-Z]{2,})/g,
    (match, left: string, right: string, offset: number, whole: string) => {
      const leftWord = left.match(/[A-Za-z]+$/)?.[0] ?? left;
      const wordStart = offset + left.length - leftWord.length;
      const prevCh = wordStart > 0 ? whole[wordStart - 1] : "";
      if (prevCh && !/\s/.test(prevCh)) return match;
      if (/^[A-Z]{2,}$/.test(right)) return match;
      const since = `${whole.slice(0, offset).split("\n\n").pop() ?? ""}${leftWord}`;
      if (since.length > 100 || /[.!?]/.test(since)) return match;
      const words = since.trim().split(/\s+/);
      if (words.length < 2 || words.length > 16) return match;
      const lowerLeft = leftWord[0] === leftWord[0]?.toLowerCase();
      if (lowerLeft || SENTENCE_START.has(right)) return `${left}\n\n${right}`;
      return match;
    },
  );
}

function blocksFromNewlines(text: string) {
  const rawLines = text.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").split("\n");
  const merged: string[] = [];
  let buf = "";
  function flush() {
    const value = buf.replace(/[ \t]+/g, " ").trim();
    if (value) merged.push(value);
    buf = "";
  }
  for (const raw of rawLines) {
    const line = raw.replace(/[ \t]+/g, " ").trim();
    if (!line) {
      flush();
      continue;
    }
    if (!buf) {
      buf = line;
      continue;
    }
    const continues = /^[a-z]/.test(line) && !/[.!?…][”"']?$/.test(buf);
    if (continues) {
      buf = `${buf} ${line}`;
      continue;
    }
    flush();
    buf = line;
  }
  flush();
  return merged;
}

export function reflowProse(text: string): string[] {
  const out: string[] = [];
  for (const chunk of blocksFromNewlines(text)) {
    const repaired = splitHeadingGlue(repairSentenceGlue(chunk));
    for (const part of repaired.split(/\n\n/)) {
      const value = part.replace(/\s+/g, " ").trim();
      if (value) out.push(value);
    }
  }
  return out;
}
