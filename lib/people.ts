import type { Item, Source } from "./types";

export type PersonRow = {
  name: string;
  count: number;
  sample: string;
  sourceIds: number[];
  topics: string[];
};

const SKIP = new Set(["unknown", "admin", "editor", "staff", "reuters", "ap", "afp"]);

export const WORLD_FIGURES: { name: string; re: RegExp }[] = [
  { name: "Donald Trump", re: /\b(donald )?trump\b/i },
  { name: "Xi Jinping", re: /\bxi jinping\b/i },
  { name: "Vladimir Putin", re: /\b(vladimir )?putin\b/i },
  { name: "Volodymyr Zelensky", re: /\bzelensky\b/i },
  { name: "Benjamin Netanyahu", re: /\b(netanyahu|bibi)\b/i },
  { name: "Keir Starmer", re: /\b(keir )?starmer\b/i },
  { name: "Emmanuel Macron", re: /\bmacron\b/i },
  { name: "Narendra Modi", re: /\b(narendra )?modi\b/i },
  { name: "Kim Jong Un", re: /\bkim jong[- ]un\b/i },
  { name: "Lai Ching-te", re: /\blai ching[- ]te\b/i },
  { name: "Ali Khamenei", re: /\b(khamenei|ayatollah)\b/i },
  { name: "Mohammed bin Salman", re: /\b(mohammed bin salman|\bmbs\b)\b/i },
  { name: "Elon Musk", re: /\b(elon musk|\bmusk\b)\b/i },
  { name: "Jerome Powell", re: /\b(jerome )?powell\b/i },
  { name: "Satya Nadella", re: /\b(satya )?nadella\b/i },
  { name: "Sam Altman", re: /\bsam altman\b/i },
];

export function personName(item: Item, source?: Source | null) {
  const raw = (item.author ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return null;
  if (source?.name && raw.toLowerCase() === source.name.toLowerCase()) return null;
  if (/@/.test(raw) || /\bassociated press\b/i.test(raw)) return null;
  if (SKIP.has(raw.toLowerCase())) return null;
  if (raw.length < 3 || raw.length > 40) return null;
  if (/[–—|]/.test(raw) || /^www\.|https?:/i.test(raw)) return null;
  if (/\b(rss|breaking news|earthquakes|press releases|top stories|publications of type|security advisories)\b/i.test(raw)) return null;
  if (/^posts from /i.test(raw)) return null;
  if (
    /\b(bbc|espn|reuters|al jazeera|france\s*24|guardian|nyt|sky sports|skysports|gdacs|usgs)\b/i.test(
      raw,
    )
  ) {
    return null;
  }
  return raw;
}

export function figuresInText(text: string) {
  return WORLD_FIGURES.filter((row) => row.re.test(text)).map((row) => row.name);
}

export function itemHasPerson(item: Item, person: string | null, source?: Source | null) {
  if (!person) return true;
  const name = personName(item, source);
  if (name && name.toLowerCase() === person.toLowerCase()) return true;
  const hay = `${item.title} ${item.summary ?? ""}`;
  if (hay.toLowerCase().includes(person.toLowerCase())) return true;
  return figuresInText(hay).some((figure) => figure.toLowerCase() === person.toLowerCase());
}

function bump(rows: Map<string, PersonRow>, name: string, item: Item) {
  const key = name.toLowerCase();
  const current = rows.get(key);
  if (!current) {
    rows.set(key, {
      name,
      count: 1,
      sample: item.title,
      sourceIds: [item.sourceId],
      topics: item.topics.slice(0, 3),
    });
    return;
  }
  current.count += 1;
  if (!current.sourceIds.includes(item.sourceId)) current.sourceIds.push(item.sourceId);
  for (const topic of item.topics) {
    if (!current.topics.includes(topic) && current.topics.length < 4) current.topics.push(topic);
  }
}

export function peopleFromItems(items: Item[], sources: Map<number, Source>): PersonRow[] {
  const rows = new Map<string, PersonRow>();
  for (const item of items) {
    const author = personName(item, sources.get(item.sourceId));
    if (author) bump(rows, author, item);
    for (const figure of figuresInText(`${item.title} ${item.summary ?? ""}`)) {
      if (!author || author.toLowerCase() !== figure.toLowerCase()) bump(rows, figure, item);
    }
  }
  return [...rows.values()].sort((a, b) => b.count - a.count);
}
