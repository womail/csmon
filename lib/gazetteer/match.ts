const EDGE_L = "(?<![\\p{L}\\p{N}_])";
const EDGE_R = "(?![\\p{L}\\p{N}_])";

function escape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
}

/** Whole-word, Unicode-aware alternation. `caseSensitive` keeps acronyms such as UN or WHO from matching words. */
export function wordsRe(names: string[], caseSensitive = false): RegExp {
  const body = [...new Set(names)]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join("|");
  return new RegExp(`${EDGE_L}(?:${body})${EDGE_R}`, caseSensitive ? "u" : "iu");
}

/** Short all-caps aliases (UN, WHO, NSA) match case-sensitively; longer names ignore case. */
export function aliasMatcher(names: string[]): (text: string) => boolean {
  const acronyms = names.filter((name) => name.length <= 5 && name === name.toUpperCase());
  const words = names.filter((name) => !acronyms.includes(name));
  const res = [acronyms.length ? wordsRe(acronyms, true) : null, words.length ? wordsRe(words) : null].filter(
    (re): re is RegExp => Boolean(re),
  );
  return (text) => res.some((re) => re.test(text));
}
