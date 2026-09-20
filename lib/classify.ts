export type Classification = {
  topics: string[];
  locations: string[];
  tags: string[];
};

const TOPICS: { tag: string; re: RegExp }[] = [
  {
    tag: "weather",
    re: /\b(storm|blizzard|tornado|cyclone|typhoon|hurricane|flood|heatwave|wildfire|severe weather|weather warning|weather watch|winter storm|thunderstorm|hail|landfall)\b/i,
  },
  {
    tag: "quake",
    re: /\b(earthquake|aftershock|seismic|magnitude|m [4-9]\.\d|tsunami watch|tsunami warning)\b/i,
  },
  {
    tag: "war",
    re: /\b(war|warfare|invasion|airstrike|frontline|occupation|combat|missile strike|troop|shelling|battlefield)\b/i,
  },
  {
    tag: "unrest",
    re: /\b(protest|protester|riot|rioting|coup|martial law|demonstration|uprising|civil unrest|looting|curfew|clashes)\b/i,
  },
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
    tag: "ai",
    re: /\b(ai\b|artificial intelligence|generative ai|chatgpt|openai|anthropic|llm|machine learning|copilot)\b/i,
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
    tag: "nuclear",
    re: /\b(nuclear|icbm|warhead|nonproliferation|uranium enrichment|plutonium|atomic weapon)\b/i,
  },
  {
    tag: "defense",
    re: /\b(pentagon|department of defense|\bdod\b|nato|air force|navy|army|military base|defense budget)\b/i,
  },
  {
    tag: "disaster",
    re: /\b(earthquake|tsunami|eruption|landslide|explosion|collapse|evacuate)\b/i,
  },
  {
    tag: "sports",
    re: /\b(premier league|champions league|world cup|six nations|super bowl|formula 1|\bf1\b|grand slam|wimbledon|olympics|transfer window|match report|\bnfl\b|\bnba\b|\bmlb\b|\bnhl\b|\bfifa\b|\buefa\b|\bgaa\b|football|soccer|rugby|cricket|tennis|golf)\b/i,
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
  { name: "London", re: /\b(london|westminster|downing street)\b/i },
  { name: "Ireland", re: /\b(ireland|irish|dublin|cork|shannon|belfast)\b/i },
  { name: "Dublin", re: /\b(dublin|dublin airport|dublin bay)\b/i },
  { name: "UK", re: /\b(\buk\b|britain|british|united kingdom)\b/i },
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
  { name: "Indonesia", re: /\b(indonesia|jakarta|sumatra|java)\b/i },
  { name: "Philippines", re: /\b(philippines|manila|luzon|mindanao)\b/i },
  { name: "California", re: /\b(california|los angeles|san francisco|napa)\b/i },
  { name: "Alaska", re: /\b(alaska|anchorage)\b/i },
  { name: "Chile", re: /\b(chile|santiago)\b/i },
  { name: "Italy", re: /\b(italy|italian|rome|sicily)\b/i },
  { name: "Greece", re: /\b(greece|greek|athens)\b/i },
  { name: "Afghanistan", re: /\b(afghanistan|kabul|taliban)\b/i },
  { name: "Myanmar", re: /\b(myanmar|burma|yangon)\b/i },
  { name: "Ethiopia", re: /\b(ethiopia|addis)\b/i },
  { name: "Somalia", re: /\b(somalia|mogadishu)\b/i },
  { name: "Libya", re: /\b(libya|tripoli)\b/i },
  { name: "Nigeria", re: /\b(nigeria|lagos|abuja)\b/i },
  { name: "Brazil", re: /\b(brazil|brasilia|rio de janeiro)\b/i },
  { name: "Australia", re: /\b(australia|sydney|canberra)\b/i },
  { name: "Canada", re: /\b(canada|ottawa|toronto)\b/i },
  { name: "Spain", re: /\b(spain|spanish|madrid)\b/i },
  { name: "Poland", re: /\b(poland|polish|warsaw)\b/i },
  { name: "Iraq", re: /\b(iraq|iraqi|baghdad)\b/i },
  { name: "West Bank", re: /\b(west bank|ramallah|jenin)\b/i },
  { name: "Caribbean", re: /\b(caribbean|puerto rico|jamaica|cuba)\b/i },
  { name: "Pacific", re: /\b(pacific ocean|guam|tonga|fiji)\b/i },
  { name: "Horn of Africa", re: /\b(horn of africa)\b/i },
  { name: "South China Sea", re: /\b(south china sea)\b/i },
  { name: "Nepal", re: /\b(nepal|kathmandu)\b/i },
  { name: "New Zealand", re: /\b(new zealand|wellington|auckland)\b/i },
  { name: "Florida", re: /\b(florida|miami|tampa)\b/i },
  { name: "Bangladesh", re: /\b(bangladesh|dhaka)\b/i },
  { name: "Singapore", re: /\b(singapore|malacca strait)\b/i },
  { name: "Greenland", re: /\b(greenland|nuuk)\b/i },
  { name: "Hormuz", re: /\b(hormuz|strait of hormuz)\b/i },
  { name: "Malacca", re: /\b(malacca|strait of malacca)\b/i },
  { name: "Suez", re: /\b(suez|suez canal)\b/i },
  { name: "Panama", re: /\b(panama canal)\b/i },
  { name: "Bab el-Mandeb", re: /\b(bab el-mandeb|bab el mandeb)\b/i },
  { name: "Gibraltar", re: /\b(gibraltar|strait of gibraltar)\b/i },
  { name: "Bosporus", re: /\b(bosporus|bosphorus)\b/i },
];

export function classify(text: string): Classification {
  const topics = TOPICS.filter(({ re }) => re.test(text)).map(({ tag }) => tag);
  if (topics.length === 0) topics.push("world");
  const locations = PLACES.filter(({ re }) => re.test(text)).map(({ name }) => name);
  const tags = [...new Set([...topics, ...locations.map((n) => n.toLowerCase())])];
  return {
    topics: [...new Set(topics)].slice(0, 6),
    locations: [...new Set(locations)].slice(0, 6),
    tags: tags.slice(0, 5),
  };
}

export function classifyText(text: string) {
  return classify(text).tags;
}

export function classifyItem(title: string, summary?: string | null) {
  return classify(`${title} ${summary ?? ""}`);
}

export function textHasTopic(text: string, topic: string) {
  const needle = topic.trim().toLowerCase();
  if (!needle) return true;
  const def = TOPICS.find((entry) => entry.tag === needle);
  if (def) return def.re.test(text);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

const EXTRA_TOPICS = ["reddit"];

export function isKnownTopic(name: string) {
  const needle = name.trim().toLowerCase();
  return TOPICS.some((entry) => entry.tag === needle) || EXTRA_TOPICS.includes(needle);
}

export function itemHasTopic(
  item: { title: string; summary?: string | null; topics: string[]; tags: string[] },
  topic: string | null,
) {
  if (!topic) return true;
  if (item.topics.includes(topic) || item.tags.includes(topic)) return true;
  return textHasTopic(`${item.title} ${item.summary ?? ""}`, topic);
}

export function textHasPlace(text: string, place: string) {
  const needle = place.trim().toLowerCase();
  if (!needle) return true;
  const def = PLACES.find((entry) => entry.name.toLowerCase() === needle);
  if (def) return def.re.test(text);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}
