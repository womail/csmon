export type PlaceRule = {
  name: string;
  /** Proper names that match alone. Case-sensitive where capitalisation matters. */
  strong: RegExp[];
  /** Ambiguous words: count only when the context regex also matches the same text. */
  weak?: { re: RegExp; context: RegExp }[];
  vetoes?: RegExp[];
};

/** Unicode-aware word edges so names such as Éire and Türkiye match. */
const edge = (source: string) => `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`;
const i = (source: string) => new RegExp(edge(source), "iu");
const cs = (source: string) => new RegExp(edge(source), "u");

export const PLACE_RULES: PlaceRule[] = [
  { name: "Ukraine", strong: [i("ukraine|ukrainian|kyiv|kiev|kharkiv|odesa|odessa|zaporizhzhia|donbas|donetsk|luhansk")] },
  { name: "Russia", strong: [i("russia|russian|moscow|kremlin|st petersburg")] },
  { name: "China", strong: [i("china|chinese|beijing|shanghai|shenzhen|hong kong")] },
  { name: "Taiwan", strong: [i("taiwan|taiwanese|taipei")] },
  { name: "Israel", strong: [i("israel|israeli|jerusalem|tel aviv"), cs("IDF")] },
  { name: "Gaza", strong: [i("gaza|rafah|khan younis")] },
  { name: "Iran", strong: [i("iran|iranian|tehran")] },
  { name: "Syria", strong: [i("syria|syrian|damascus|aleppo")] },
  { name: "Yemen", strong: [i("yemen|yemeni|sanaa|sana'a")], weak: [{ re: cs("Aden"), context: i("yemen|port|gulf") }] },
  { name: "Sudan", strong: [i("sudan|sudanese|khartoum|darfur|el fasher")] },
  {
    name: "Sahel",
    strong: [i("sahel|burkina faso|bamako|niamey")],
    weak: [
      { re: cs("Mali"), context: i("junta|sahel|bamako|jihadist|wagner|africa") },
      { re: cs("Niger"), context: i("junta|sahel|niamey|jihadist|coup|africa") },
    ],
  },
  {
    name: "US",
    strong: [
      i("united states|white house|pentagon|capitol hill|washington,? d\\.?c\\.?"),
      /\b(?:US|USA)\b|\bU\.S\.(?:A\.)?/,
    ],
    weak: [{ re: cs("Washington"), context: i("administration|officials|congress|lawmakers|white house|said|d\\.c\\.") }],
    vetoes: [i("washington post|washington state|university of washington|washington commanders|washington nationals")],
  },
  { name: "London", strong: [i("london|westminster|downing street")] },
  {
    name: "Ireland",
    strong: [i("ireland|irish|dublin|galway|limerick|waterford|belfast|éire|eire|northern ireland|taoiseach|dáil"), cs("Cork")],
    weak: [{ re: cs("Shannon"), context: i("airport|river|clare|limerick|estuary") }],
  },
  { name: "Dublin", strong: [i("dublin")] },
  { name: "UK", strong: [i("britain|british|united kingdom"), cs("UK|U\\.K\\.")] },
  { name: "EU", strong: [i("european union|brussels|european commission"), cs("EU")] },
  { name: "Korea", strong: [i("korea|korean|seoul|pyongyang")] },
  { name: "Japan", strong: [i("japan|japanese|tokyo|osaka")] },
  {
    name: "India",
    strong: [i("india|delhi|new delhi|mumbai|bengaluru|bangalore")],
    weak: [{ re: i("indian"), context: i("india|delhi|mumbai|rupee|government|army|navy|cricket") }],
    vetoes: [i("indian ocean|native indian|american indian|indian wells")],
  },
  { name: "Pakistan", strong: [i("pakistan|pakistani|islamabad|karachi|lahore")] },
  { name: "Mexico", strong: [i("mexico|mexican|mexico city")] },
  { name: "Venezuela", strong: [i("venezuela|venezuelan|caracas")] },
  { name: "Haiti", strong: [i("haiti|haitian|port-au-prince")] },
  { name: "Lebanon", strong: [i("lebanon|lebanese|beirut")] },
  {
    name: "Turkey",
    strong: [i("türkiye|turkiye|ankara|istanbul|turkish"), cs("Turkey")],
    vetoes: [i("turkey (?:prices|dinner|sandwich|sandwiches|farm|farms)|thanksgiving turkey|roast turkey")],
  },
  { name: "Germany", strong: [i("germany|german|berlin|munich|frankfurt|bundestag")] },
  {
    name: "France",
    strong: [i("france|french|élysée|elysee"), cs("Paris")],
    weak: [{ re: cs("Lyon|Marseille|Toulouse"), context: i("france|french|police|mayor|protest|city|residents") }],
    vetoes: [i("paris hilton|paris jackson|paris saint-germain|paris agreement|paris fc")],
  },
  { name: "Arctic", strong: [i("arctic")] },
  { name: "Red Sea", strong: [i("red sea")] },
  { name: "Taiwan Strait", strong: [i("taiwan strait")] },
  {
    name: "Indonesia",
    strong: [i("indonesia|indonesian|jakarta|sumatra|bali|sulawesi")],
    weak: [{ re: cs("Java"), context: i("island|indonesia|jakarta|earthquake|volcano|quake|flood") }],
  },
  { name: "Philippines", strong: [i("philippines|philippine|filipino|manila|luzon|mindanao")] },
  { name: "California", strong: [i("california|los angeles|san francisco|napa|sacramento")] },
  { name: "Alaska", strong: [i("alaska|anchorage")] },
  { name: "Chile", strong: [i("chile|chilean")], weak: [{ re: cs("Santiago"), context: i("chile|chilean") }] },
  { name: "Italy", strong: [i("italy|italian|rome|sicily|milan|naples|vatican|pope")] },
  { name: "Greece", strong: [i("greece|greek|athens")] },
  { name: "Afghanistan", strong: [i("afghanistan|afghan|kabul")] },
  { name: "Myanmar", strong: [i("myanmar|burma|yangon|naypyidaw")] },
  { name: "Ethiopia", strong: [i("ethiopia|ethiopian|addis ababa|tigray")] },
  { name: "Somalia", strong: [i("somalia|somali|mogadishu")] },
  { name: "Libya", strong: [i("libya|libyan"), cs("Tripoli")] },
  { name: "Nigeria", strong: [i("nigeria|nigerian|abuja")], weak: [{ re: cs("Lagos"), context: i("nigeria|nigerian") }] },
  { name: "Brazil", strong: [i("brazil|brazilian|brasilia|brasília|rio de janeiro|são paulo|sao paulo")] },
  { name: "Australia", strong: [i("australia|australian|canberra|melbourne")], weak: [{ re: cs("Sydney"), context: i("australia|harbour|nsw|new south wales") }], vetoes: [i("sydney sweeney")] },
  { name: "Canada", strong: [i("canada|canadian|ottawa|toronto|vancouver|montreal")] },
  { name: "Spain", strong: [i("spain|spanish|madrid|catalonia|barcelona city")] },
  { name: "Poland", strong: [i("poland|polish|warsaw")] },
  { name: "Iraq", strong: [i("iraq|iraqi|baghdad|mosul|erbil")] },
  { name: "West Bank", strong: [i("west bank|ramallah|jenin|nablus")] },
  { name: "Caribbean", strong: [i("caribbean|puerto rico|jamaica|cuba|cuban|havana")] },
  { name: "Pacific", strong: [i("pacific ocean|guam|tonga|fiji|samoa")] },
  { name: "Horn of Africa", strong: [i("horn of africa")] },
  { name: "South China Sea", strong: [i("south china sea|spratly|scarborough shoal")] },
  { name: "Nepal", strong: [i("nepal|kathmandu")] },
  { name: "New Zealand", strong: [i("new zealand|auckland")], weak: [{ re: cs("Wellington"), context: i("new zealand|nz") }] },
  { name: "Florida", strong: [i("florida|tampa|orlando")], weak: [{ re: cs("Miami"), context: i("florida|hurricane|storm|flood|police|beach") }], vetoes: [i("miami heat|miami dolphins|inter miami")] },
  { name: "Bangladesh", strong: [i("bangladesh|dhaka")] },
  { name: "Singapore", strong: [i("singapore")] },
  { name: "Greenland", strong: [i("greenland|nuuk")] },
  { name: "Hormuz", strong: [i("hormuz|strait of hormuz")] },
  { name: "Malacca", strong: [i("malacca|strait of malacca")] },
  { name: "Suez", strong: [i("suez|suez canal")] },
  { name: "Panama", strong: [i("panama canal")] },
  { name: "Bab el-Mandeb", strong: [i("bab el-mandeb|bab el mandeb|bab al-mandab")] },
  { name: "Gibraltar", strong: [i("gibraltar|strait of gibraltar")] },
  { name: "Bosporus", strong: [i("bosporus|bosphorus")] },
];

/** Leaders and armed groups that imply a home place only when the text names no place. */
export const ACTOR_HOMES: { re: RegExp; place: string; label: string }[] = [
  { re: i("putin|lavrov|peskov"), place: "Russia", label: "Russian leadership" },
  { re: i("xi jinping"), place: "China", label: "Chinese leadership" },
  { re: i("zelensky|zelenskyy|zelenskiy"), place: "Ukraine", label: "Ukrainian leadership" },
  { re: i("netanyahu"), place: "Israel", label: "Israeli leadership" },
  { re: i("modi"), place: "India", label: "Indian leadership" },
  { re: i("macron"), place: "France", label: "French leadership" },
  { re: i("erdogan|erdoğan"), place: "Turkey", label: "Turkish leadership" },
  { re: i("maduro"), place: "Venezuela", label: "Venezuelan leadership" },
  { re: i("khamenei|pezeshkian"), place: "Iran", label: "Iranian leadership" },
  { re: i("starmer"), place: "UK", label: "UK leadership" },
  { re: i("kim jong[- ]un"), place: "Korea", label: "North Korean leadership" },
  { re: i("hamas"), place: "Gaza", label: "Hamas" },
  { re: i("hezbollah"), place: "Lebanon", label: "Hezbollah" },
  { re: i("houthis?"), place: "Yemen", label: "Houthis" },
  { re: i("taliban"), place: "Afghanistan", label: "Taliban" },
  { re: i("al-shabaab|al shabaab"), place: "Somalia", label: "al-Shabaab" },
];

function ruleMatches(rule: PlaceRule, text: string) {
  if (rule.vetoes?.some((veto) => veto.test(text))) {
    // A veto removes this place unless a different strong name for it is also present.
    const scrubbed = rule.vetoes.reduce((acc, veto) => acc.replace(new RegExp(veto.source, "gi"), " "), text);
    return rule.strong.some((re) => re.test(scrubbed)) || Boolean(rule.weak?.some((w) => w.re.test(scrubbed) && w.context.test(scrubbed)));
  }
  if (rule.strong.some((re) => re.test(text))) return true;
  return Boolean(rule.weak?.some((w) => w.re.test(text) && w.context.test(text)));
}

export function placesInText(text: string): string[] {
  const found = PLACE_RULES.filter((rule) => ruleMatches(rule, text)).map((rule) => rule.name);
  if (found.length) return [...new Set(found)];
  return [...new Set(ACTOR_HOMES.filter((actor) => actor.re.test(text)).map((actor) => actor.place))];
}

export function placeRule(name: string) {
  const needle = name.trim().toLowerCase();
  return PLACE_RULES.find((rule) => rule.name.toLowerCase() === needle);
}

export function textMatchesPlace(text: string, place: string) {
  const rule = placeRule(place);
  if (rule) {
    if (ruleMatches(rule, text)) return true;
    const anyPlace = PLACE_RULES.some((other) => ruleMatches(other, text));
    return !anyPlace && ACTOR_HOMES.some((actor) => actor.place === rule.name && actor.re.test(text));
  }
  const escaped = place.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return escaped ? new RegExp(`\\b${escaped}\\b`, "i").test(text) : true;
}
