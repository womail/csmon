import { looksLikePersonName } from "../bylines";
import { aliasMatcher, wordsRe } from "./match";

export type Figure = {
  name: string;
  aliases: string[];
  /** Surname alone is enough (Trump, Putin, Zelensky…). */
  surnameSafe?: boolean;
  role: string;
  country?: string;
  domain?: "politics" | "business" | "tech" | "security" | "sports";
};

const P = (
  name: string,
  role: string,
  country?: string,
  opts: { aliases?: string[]; surnameSafe?: boolean; domain?: Figure["domain"] } = {},
): Figure => ({ name, role, country, aliases: opts.aliases ?? [], surnameSafe: opts.surnameSafe, domain: opts.domain ?? "politics" });

export const FIGURES: Figure[] = [
  P("Donald Trump", "President of the United States", "US", { surnameSafe: true }),
  P("JD Vance", "Vice President of the United States", "US", { aliases: ["J.D. Vance"], surnameSafe: true }),
  P("Marco Rubio", "US Secretary of State", "US", { surnameSafe: true }),
  P("Pete Hegseth", "US Secretary of Defense", "US", { surnameSafe: true }),
  P("Scott Bessent", "US Treasury Secretary", "US", { surnameSafe: true }),
  P("Tulsi Gabbard", "US Director of National Intelligence", "US", { surnameSafe: true }),
  P("Kash Patel", "FBI Director", "US", { domain: "security" }),
  P("Joe Biden", "Former US President", "US", { surnameSafe: true }),
  P("Kamala Harris", "Former US Vice President", "US"),
  P("Xi Jinping", "President of China", "China", { aliases: ["Xi"] }),
  P("Li Qiang", "Premier of China", "China"),
  P("Wang Yi", "Foreign Minister of China", "China"),
  P("Vladimir Putin", "President of Russia", "Russia", { surnameSafe: true }),
  P("Sergei Lavrov", "Foreign Minister of Russia", "Russia", { aliases: ["Sergey Lavrov"], surnameSafe: true }),
  P("Dmitry Peskov", "Kremlin spokesman", "Russia", { surnameSafe: true }),
  P("Volodymyr Zelensky", "President of Ukraine", "Ukraine", { aliases: ["Zelenskyy", "Zelenskiy"], surnameSafe: true }),
  P("Andrii Sybiha", "Foreign Minister of Ukraine", "Ukraine", { surnameSafe: true }),
  P("Benjamin Netanyahu", "Prime Minister of Israel", "Israel", { aliases: ["Bibi Netanyahu"], surnameSafe: true }),
  P("Israel Katz", "Defence Minister of Israel", "Israel"),
  P("Ali Khamenei", "Supreme Leader of Iran", "Iran", { aliases: ["Ayatollah Khamenei"], surnameSafe: true }),
  P("Masoud Pezeshkian", "President of Iran", "Iran", { surnameSafe: true }),
  P("Abbas Araghchi", "Foreign Minister of Iran", "Iran", { surnameSafe: true }),
  P("Keir Starmer", "Prime Minister of the United Kingdom", "UK", { surnameSafe: true }),
  P("Rachel Reeves", "UK Chancellor of the Exchequer", "UK"),
  P("Kemi Badenoch", "Leader of the UK Conservative Party", "UK", { surnameSafe: true }),
  P("Nigel Farage", "Leader of Reform UK", "UK", { surnameSafe: true }),
  P("Emmanuel Macron", "President of France", "France", { surnameSafe: true }),
  P("Friedrich Merz", "Chancellor of Germany", "Germany", { surnameSafe: true }),
  P("Olaf Scholz", "Former Chancellor of Germany", "Germany", { surnameSafe: true }),
  P("Giorgia Meloni", "Prime Minister of Italy", "Italy", { surnameSafe: true }),
  P("Pedro Sánchez", "Prime Minister of Spain", "Spain", { aliases: ["Pedro Sanchez"] }),
  P("Donald Tusk", "Prime Minister of Poland", "Poland", { surnameSafe: true }),
  P("Viktor Orbán", "Prime Minister of Hungary", "Hungary", { aliases: ["Viktor Orban", "Orban"], surnameSafe: true }),
  P("Recep Tayyip Erdogan", "President of Turkey", "Turkey", { aliases: ["Erdoğan", "Tayyip Erdogan"], surnameSafe: true }),
  P("Narendra Modi", "Prime Minister of India", "India", { surnameSafe: true }),
  P("Shehbaz Sharif", "Prime Minister of Pakistan", "Pakistan"),
  P("Asim Munir", "Chief of Army Staff of Pakistan", "Pakistan"),
  P("Mark Carney", "Prime Minister of Canada", "Canada", { surnameSafe: true }),
  P("Anthony Albanese", "Prime Minister of Australia", "Australia", { surnameSafe: true }),
  P("Shigeru Ishiba", "Prime Minister of Japan", "Japan", { surnameSafe: true }),
  P("Sanae Takaichi", "Prime Minister of Japan", "Japan", { surnameSafe: true }),
  P("Lee Jae-myung", "President of South Korea", "South Korea", { aliases: ["Lee Jae Myung"] }),
  P("Kim Jong Un", "Leader of North Korea", "North Korea", { aliases: ["Kim Jong-un"] }),
  P("Lai Ching-te", "President of Taiwan", "Taiwan", { aliases: ["William Lai"] }),
  P("Prabowo Subianto", "President of Indonesia", "Indonesia", { surnameSafe: true }),
  P("Luiz Inácio Lula da Silva", "President of Brazil", "Brazil", { aliases: ["Lula", "Lula da Silva"] }),
  P("Javier Milei", "President of Argentina", "Argentina", { surnameSafe: true }),
  P("Claudia Sheinbaum", "President of Mexico", "Mexico", { surnameSafe: true }),
  P("Nicolás Maduro", "President of Venezuela", "Venezuela", { aliases: ["Nicolas Maduro"], surnameSafe: true }),
  P("Cyril Ramaphosa", "President of South Africa", "South Africa", { surnameSafe: true }),
  P("Bola Tinubu", "President of Nigeria", "Nigeria", { surnameSafe: true }),
  P("Abdel Fattah el-Sisi", "President of Egypt", "Egypt", { aliases: ["Sisi", "el-Sisi"] }),
  P("Mohammed bin Salman", "Crown Prince of Saudi Arabia", "Saudi Arabia", { aliases: ["MBS"] }),
  P("Sheikh Tamim bin Hamad Al Thani", "Emir of Qatar", "Qatar", { aliases: ["Emir Tamim"] }),
  P("Ahmed al-Sharaa", "President of Syria", "Syria", { aliases: ["al-Sharaa", "Abu Mohammed al-Jolani"] }),
  P("Abdel Fattah al-Burhan", "Sudanese army chief", "Sudan", { aliases: ["al-Burhan", "Burhan"] }),
  P("Mohamed Hamdan Dagalo", "RSF commander", "Sudan", { aliases: ["Hemedti"] }),
  P("Micheál Martin", "Taoiseach of Ireland", "Ireland", { aliases: ["Micheal Martin"] }),
  P("Simon Harris", "Tánaiste of Ireland", "Ireland"),
  P("Catherine Connolly", "President of Ireland", "Ireland"),
  P("Ursula von der Leyen", "President of the European Commission", "Belgium", { aliases: ["von der Leyen"] }),
  P("Kaja Kallas", "EU foreign policy chief", "Belgium", { surnameSafe: true }),
  P("António Costa", "President of the European Council", "Belgium", { aliases: ["Antonio Costa"] }),
  P("Mark Rutte", "NATO Secretary General", "Belgium", { surnameSafe: true }),
  P("António Guterres", "UN Secretary-General", undefined, { aliases: ["Antonio Guterres"], surnameSafe: true }),
  P("Tedros Adhanom Ghebreyesus", "WHO Director-General", undefined, { aliases: ["Tedros"] }),
  P("Rafael Grossi", "IAEA Director General", undefined, { surnameSafe: true }),
  P("Kristalina Georgieva", "IMF Managing Director", undefined, { surnameSafe: true, domain: "business" }),
  P("Jerome Powell", "Chair of the US Federal Reserve", "US", { domain: "business" }),
  P("Christine Lagarde", "President of the European Central Bank", "Germany", { surnameSafe: true, domain: "business" }),
  P("Andrew Bailey", "Governor of the Bank of England", "UK", { domain: "business" }),
  P("Elon Musk", "CEO of Tesla and SpaceX", "US", { surnameSafe: true, domain: "tech" }),
  P("Sam Altman", "CEO of OpenAI", "US", { surnameSafe: true, domain: "tech" }),
  P("Satya Nadella", "CEO of Microsoft", "US", { surnameSafe: true, domain: "tech" }),
  P("Sundar Pichai", "CEO of Alphabet", "US", { surnameSafe: true, domain: "tech" }),
  P("Tim Cook", "CEO of Apple", "US", { domain: "tech" }),
  P("Mark Zuckerberg", "CEO of Meta", "US", { surnameSafe: true, domain: "tech" }),
  P("Jensen Huang", "CEO of Nvidia", "US", { domain: "tech" }),
  P("Dario Amodei", "CEO of Anthropic", "US", { surnameSafe: true, domain: "tech" }),
  P("Demis Hassabis", "CEO of Google DeepMind", "UK", { surnameSafe: true, domain: "tech" }),
  P("Jeff Bezos", "Founder of Amazon", "US", { surnameSafe: true, domain: "business" }),
  P("Sean Plankey", "Director of CISA", "US", { domain: "security" }),
  P("Richard Horne", "CEO of the UK NCSC", "UK", { domain: "security" }),
];

type Compiled = { figure: Figure; test: (text: string) => boolean };

const COMPILED: Compiled[] = FIGURES.map((figure) => {
  const surname = figure.name.split(" ").at(-1) ?? figure.name;
  const names = [figure.name, ...figure.aliases, ...(figure.surnameSafe ? [surname] : [])];
  const full = aliasMatcher(names.filter((name) => name.length > 2));
  const shortCs = names.filter((name) => name.length <= 2);
  const short = shortCs.length ? wordsRe(shortCs, true) : null;
  return { figure, test: (text) => full(text) || Boolean(short?.test(text)) };
});

const figureByKey = new Map<string, Figure>();
for (const figure of FIGURES) {
  figureByKey.set(figure.name.toLowerCase(), figure);
  for (const alias of figure.aliases) figureByKey.set(alias.toLowerCase(), figure);
}

export function figureByName(name: string): Figure | undefined {
  return figureByKey.get(name.trim().toLowerCase());
}

export function figuresInText(text: string): Figure[] {
  return COMPILED.filter((row) => row.test(text)).map((row) => row.figure);
}

const ROLE_ANCHOR =
  /(?<![\p{L}])(President|Prime Minister|Foreign Minister|Defen[cs]e Minister|Finance Minister|Minister|Chancellor|Secretary(?: of State| of Defense| General)?|Senator|Sen\.|Rep\.|CEO|chief executive|spokesperson|spokesman|spokeswoman|General|Gen\.|Admiral|Governor|Mayor)\s+((?:[A-Z][\p{L}'’.-]+\s+){1,3}[A-Z][\p{L}'’-]+)/gu;

export type DiscoveredPerson = { name: string; role: string };

/** People named right after a role word ("Foreign Minister Wang Yi"). Precision over recall. */
export function rolePeopleInText(text: string): DiscoveredPerson[] {
  const out = new Map<string, DiscoveredPerson>();
  for (const match of text.matchAll(ROLE_ANCHOR)) {
    const role = match[1].replace(/\.$/, "");
    let name = match[2].trim();
    const words = name.split(/\s+/);
    while (words.length > 2 && !looksLikePersonName(words.join(" "))) words.pop();
    name = words.join(" ");
    if (!looksLikePersonName(name)) continue;
    const known = figureByName(name);
    const key = (known?.name ?? name).toLowerCase();
    if (!out.has(key)) out.set(key, { name: known?.name ?? name, role: known?.role ?? role });
  }
  return [...out.values()];
}

/** Whole-word match on a figure's names, or the literal name for anyone else. */
export function textMentionsPerson(text: string, person: string): boolean {
  const figure = figureByName(person);
  if (figure) return COMPILED.find((row) => row.figure === figure)?.test(text) ?? false;
  if (person.trim().length < 3) return false;
  return wordsRe([person.trim()]).test(text);
}
