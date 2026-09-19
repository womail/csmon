export type Classification = {
  topics: string[];
  locations: string[];
  tags: string[];
};

const TOPICS: { tag: string; re: RegExp }[] = [
  {
    tag: "conflict",
    re: /\b(war|warfare|attack|missile|troop|airstrike|combat|invasion|ceasefire|frontline|drone|shelling|casualt)/i,
  },
  {
    tag: "cyber",
    re: /\b(hack|ransomware|malware|phishing|zero[- ]day|data breach|cyberattack|cve-\d|advisory|exploit|vulnerability|cisa|kev|patch tuesday|threat actor|apt\d|botnet|wiper|lockbit|outage)\b/i,
  },
  {
    tag: "markets",
    re: /\b(stock|stocks|market|markets|fed\b|inflation|bitcoin|oil price|gdp|yields|nasdaq|recession)\b/i,
  },
  {
    tag: "tech",
    re: /\b(ai\b|openai|anthropic|google|apple|microsoft|chip|semiconductor|llm|startup)\b/i,
  },
  {
    tag: "energy",
    re: /\b(oil|gas|opec|pipeline|nuclear plant|lng|refinery|power grid|blackout)\b/i,
  },
  {
    tag: "climate",
    re: /\b(climate|flood|hurricane|wildfire|drought|heatwave|emissions|carbon|typhoon)\b/i,
  },
  {
    tag: "health",
    re: /\b(outbreak|vaccine|hospital|who\b|pandemic|epidemic|virus|cholera)\b/i,
  },
  {
    tag: "politics",
    re: /\b(election|president|parliament|sanction|congress|minister|vote|bill|coalition)\b/i,
  },
  {
    tag: "diplomacy",
    re: /\b(nato|un\b|summit|treaty|envoy|negotiat|ceasefire talk|embassy)\b/i,
  },
  {
    tag: "science",
    re: /\b(nasa|study|research|quantum|physics|space|telescope)\b/i,
  },
  {
    tag: "disaster",
    re: /\b(earthquake|tsunami|eruption|landslide|explosion|collapse|evacuate)\b/i,
  },
];

const PLACES: { name: string; re: RegExp }[] = [
  { name: "Ukraine", re: /\b(ukraine|ukrainian|kyiv|kiev|kharkiv|odesa|zaporizhzhia)\b/i },
  { name: "Russia", re: /\b(russia|russian|moscow|kremlin|putin)\b/i },
  { name: "China", re: /\b(china|chinese|beijing|xi jinping)\b/i },
  { name: "Taiwan", re: /\b(taiwan|taipei|strait)\b/i },
  { name: "Israel", re: /\b(israel|israeli|jerusalem|idf)\b/i },
  { name: "Gaza", re: /\b(gaza|rafah|hamas)\b/i },
  { name: "Iran", re: /\b(iran|iranian|tehran)\b/i },
  { name: "Syria", re: /\b(syria|syrian|damascus)\b/i },
  { name: "Yemen", re: /\b(yemen|houthi|aden)\b/i },
  { name: "Sudan", re: /\b(sudan|khartoum|darfur)\b/i },
  { name: "Sahel", re: /\b(sahel|mali|niger|burkina)\b/i },
  { name: "US", re: /\b(united states|\bu\.?s\.a?\b|washington|white house|pentagon)\b/i },
  { name: "UK", re: /\b(\buk\b|britain|british|london|downing street)\b/i },
  { name: "EU", re: /\b(\beu\b|brussels|european union)\b/i },
  { name: "Korea", re: /\b(korea|korean|seoul|pyongyang)\b/i },
  { name: "Japan", re: /\b(japan|japanese|tokyo)\b/i },
  { name: "India", re: /\b(india|indian|delhi|modi)\b/i },
  { name: "Pakistan", re: /\b(pakistan|islamabad)\b/i },
  { name: "Mexico", re: /\b(mexico|mexican)\b/i },
  { name: "Venezuela", re: /\b(venezuela|maduro)\b/i },
  { name: "Haiti", re: /\b(haiti|port-au-prince)\b/i },
  { name: "Lebanon", re: /\b(lebanon|beirut|hezbollah)\b/i },
  { name: "Turkey", re: /\b(turkey|türkiye|ankara|erdogan)\b/i },
  { name: "Germany", re: /\b(germany|german|berlin)\b/i },
  { name: "France", re: /\b(france|french|paris|macron)\b/i },
  { name: "Arctic", re: /\b(arctic|greenland)\b/i },
  { name: "Red Sea", re: /\b(red sea|bab el-mandeb|suez)\b/i },
  { name: "Taiwan Strait", re: /\b(taiwan strait)\b/i },
];

export function classify(text: string): Classification {
  const topics = TOPICS.filter(({ re }) => re.test(text)).map(({ tag }) => tag);
  if (topics.length === 0) topics.push("world");
  const locations = PLACES.filter(({ re }) => re.test(text)).map(({ name }) => name);
  const tags = [...new Set([...topics, ...locations.map((n) => n.toLowerCase())])];
  return {
    topics: [...new Set(topics)].slice(0, 4),
    locations: [...new Set(locations)].slice(0, 4),
    tags: tags.slice(0, 5),
  };
}

export function classifyText(text: string) {
  return classify(text).tags;
}

export function classifyItem(title: string, summary?: string | null) {
  return classify(`${title} ${summary ?? ""}`);
}
