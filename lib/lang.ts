export type LangOption = {
  id: string;
  name: string;
};

export const HOME_LANGUAGES: LangOption[] = [
  { id: "en", name: "English" },
  { id: "es", name: "Spanish" },
  { id: "fr", name: "French" },
  { id: "de", name: "German" },
  { id: "pt", name: "Portuguese" },
  { id: "it", name: "Italian" },
  { id: "nl", name: "Dutch" },
  { id: "pl", name: "Polish" },
  { id: "uk", name: "Ukrainian" },
  { id: "ru", name: "Russian" },
  { id: "ar", name: "Arabic" },
  { id: "zh", name: "Chinese" },
  { id: "ja", name: "Japanese" },
  { id: "ko", name: "Korean" },
  { id: "hi", name: "Hindi" },
  { id: "tr", name: "Turkish" },
  { id: "sv", name: "Swedish" },
  { id: "id", name: "Indonesian" },
];

const STOP: { id: string; name: string; words: string[] }[] = [
  { id: "en", name: "English", words: ["the", "and", "that", "with", "from", "this", "have", "were", "said"] },
  { id: "es", name: "Spanish", words: ["que", "los", "las", "del", "una", "por", "para", "con", "como"] },
  { id: "fr", name: "French", words: ["les", "des", "une", "dans", "pour", "que", "qui", "pas", "sur"] },
  { id: "de", name: "German", words: ["und", "die", "der", "das", "den", "nicht", "mit", "auf", "von"] },
  { id: "pt", name: "Portuguese", words: ["que", "uma", "para", "com", "nao", "por", "mais", "como", "dos"] },
  { id: "it", name: "Italian", words: ["che", "non", "per", "una", "con", "del", "della", "sono", "piu"] },
  { id: "nl", name: "Dutch", words: ["het", "van", "een", "dat", "niet", "voor", "met", "zijn", "op"] },
  { id: "pl", name: "Polish", words: ["nie", "jest", "sie", "na", "do", "to", "jak", "po", "za"] },
  { id: "uk", name: "Ukrainian", words: ["не", "на", "що", "як", "для", "про", "це", "від", "та"] },
  { id: "ru", name: "Russian", words: ["и", "в", "не", "на", "что", "как", "по", "это", "из"] },
];

export function languageName(id: string) {
  return HOME_LANGUAGES.find((lang) => lang.id === id)?.name ?? id;
}

export function normalizeLang(raw: string | null | undefined) {
  if (!raw) return "";
  const id = raw.trim().toLowerCase().replace("_", "-").split("-")[0];
  return HOME_LANGUAGES.some((lang) => lang.id === id) ? id : id.slice(0, 2);
}

export function detectBrowserLanguage() {
  if (typeof navigator === "undefined") return "en";
  return normalizeLang(navigator.language) || "en";
}

export function detectLanguage(text: string, htmlLang?: string | null) {
  const hinted = normalizeLang(htmlLang);
  if (hinted) {
    return { id: hinted, name: languageName(hinted), confidence: 0.7, source: "page" as const };
  }
  const sample = text.slice(0, 4000);
  if (/[\u4e00-\u9fff]/.test(sample)) return { id: "zh", name: "Chinese", confidence: 0.92, source: "script" as const };
  if (/[\u3040-\u30ff]/.test(sample)) return { id: "ja", name: "Japanese", confidence: 0.92, source: "script" as const };
  if (/[\uac00-\ud7af]/.test(sample)) return { id: "ko", name: "Korean", confidence: 0.92, source: "script" as const };
  if (/[\u0600-\u06ff]/.test(sample)) return { id: "ar", name: "Arabic", confidence: 0.9, source: "script" as const };
  if (/[\u0900-\u097f]/.test(sample)) return { id: "hi", name: "Hindi", confidence: 0.88, source: "script" as const };
  const tokens = sample
    .toLowerCase()
    .replace(/[^a-z\u00c0-\u024f\u0400-\u04ff\u0600-\u06ff\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  let best = { id: "en", name: "English", score: 0 };
  for (const lang of STOP) {
    let score = 0;
    for (const token of tokens) if (lang.words.includes(token)) score += 1;
    if (score > best.score) best = { id: lang.id, name: lang.name, score };
  }
  const confidence = tokens.length ? Math.min(0.95, best.score / Math.max(8, tokens.length * 0.08)) : 0.2;
  return { id: best.id, name: languageName(best.id), confidence, source: "copy" as const };
}
