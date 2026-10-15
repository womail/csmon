export type Classification = {
  topics: string[];
  locations: string[];
  tags: string[];
};

const TOPICS: { tag: string; re: RegExp }[] = [
  {
    tag: "weather",
    re: /\b(storm|blizzard|tornado|cyclone|typhoon|hurricane|flood|flood advisory|flash flood|heatwave|wildfire|severe weather|weather warning|weather watch|winter storm|thunderstorm|hail|landfall|advisory issued|warning issued|watch issued|by nws|national weather service)\b/i,
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
    re: /\b(hack|ransomware|malware|phishing|zero[- ]day|data breach|cyberattack|cve-\d|(?:security|cyber|vendor|software|patch|cisa|ics) advisory|exploit|vulnerability|cisa|kev|patch tuesday|threat actor|apt\d|botnet|wiper|lockbit)\b/i,
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
    re: /\b(premier league|champions league|world cup|six nations|super bowl|formula 1|\bf1\b|grand slam|wimbledon|olympics|paralympics|transfer window|match report|full[- ]time|half[- ]time|penalty shoot|\bnfl\b|\bnba\b|\bmlb\b|\bnhl\b|\bmls\b|\bfifa\b|\buefa\b|\bgaa\b|football|soccer|rugby|cricket|tennis|golf|hurling|camogie|athletics|marathon|cycling|tour de france|motogp|\bucl\b|\bepl\b|la liga|serie a|bundesliga|ligue 1|eredivisie|fa cup|carabao cup|europa league|conference league|all[- ]ireland|heineken cup|six nations|ashes series|test match|odi\b|t20\b|ipl\b|pga tour|masters tournament|ryder cup|open championship|stanley cup|world series|march madness|college football|touchdown|quarterback|striker|goalkeeper|midfielder|defender|hat[- ]trick|see off|back-to-back wins)\b/i,
  },
];

/** Extra chips on cards (filterable via `topic:` / tag click when present in tags). */
const SPORT_SUBTAGS: { tag: string; re: RegExp }[] = [
  {
    tag: "soccer",
    re: /\b(soccer|premier league|champions league|la liga|serie a|bundesliga|ligue 1|eredivisie|mls|\buefa\b|\bfifa\b|world cup|euro 202|euros 202|fa cup|carabao cup|europa league|conference league|\bucl\b|\bepl\b|penalty shoot|offside|striker|goalkeeper|midfielder|manchester united|manchester city|liverpool|arsenal|chelsea|tottenham|real madrid|barcelona|bayern|psg|juventus|inter milan|ac milan|messi|ronaldo|haaland|salah|var decision)\b/i,
  },
  {
    tag: "nfl",
    re: /\b(\bnfl\b|super bowl|touchdown|quarterback|\bqb\b|linebacker|wide receiver|tight end|field goal|draft pick|wild[- ]card|pro bowl|nfc\b|afc\b|patriots|cowboys|chiefs|eagles|49ers|niners|packers|ravens|bills|dolphins|steelers|giants|jets|browns|bengals|lions|vikings|texans|colts|jaguars|titans|broncos|raiders|chargers|rams|seahawks|cardinals|saints|falcons|panthers|buccaneers|commanders|bears)\b/i,
  },
  {
    tag: "rugby",
    re: /\b(rugby|six nations|rugby world cup|premiership rugby|urc\b|gallagher premiership|scrum|lineout|try scorer|all blacks|springboks|wales rugby|ireland rugby|england rugby|france rugby)\b/i,
  },
  {
    tag: "cricket",
    re: /\b(cricket|ashes|test match|odi\b|t20\b|ipl\b|wicket|century|bowler|batsman|the hundred|county championship)\b/i,
  },
  {
    tag: "tennis",
    re: /\b(tennis|wimbledon|roland garros|french open|us open|australian open|grand slam|atp\b|wta\b|davis cup|billie jean king cup)\b/i,
  },
  {
    tag: "golf",
    re: /\b(golf|pga tour|masters tournament|ryder cup|open championship|british open|lpga|birdie|eagle|bogey)\b/i,
  },
  {
    tag: "f1",
    re: /\b(formula 1|\bf1\b|grand prix|qualifying|pole position|motogp|moto gp)\b/i,
  },
  {
    tag: "basketball",
    re: /\b(\bnba\b|basketball|march madness|ncaa basketball|wnba\b|lakers|celtics|warriors|knicks|nets|bulls|heat|bucks|nuggets|suns|mavericks)\b/i,
  },
  {
    tag: "baseball",
    re: /\b(\bmlb\b|baseball|world series|home run|pitcher|yankees|dodgers|red sox|mets|cubs|astros|braves|phillies|padres|mariners)\b/i,
  },
  {
    tag: "hockey",
    re: /\b(\bnhl\b|hockey|stanley cup|ice hockey|power play|hat trick)\b/i,
  },
  {
    tag: "gaa",
    re: /\b(\bgaa\b|hurling|camogie|all[- ]ireland|gaelic football|senior championship|croke park)\b/i,
  },
];

export function sportSubtags(text: string): string[] {
  return SPORT_SUBTAGS.filter(({ re }) => re.test(text)).map(({ tag }) => tag);
}

export function textLooksLikeSports(text: string) {
  const sportsTopic = TOPICS.find((entry) => entry.tag === "sports");
  return Boolean(sportsTopic?.re.test(text)) || sportSubtags(text).length > 0;
}

/** Intel RSS layers in the sports pack (`lib/intel-feeds.ts`). */
export const SPORTS_INTEL_HANDLES = new Set([
  "bbc-sport",
  "bbc-football",
  "guardian-sport",
  "espn",
  "nyt-sports",
  "sky-sports",
]);

const SPORTS_FEED_RE =
  /feeds\.bbci\.co\.uk\/sport|theguardian\.com\/sport|espn\.com\/espn|skysports\.com|nyt.*Sports\.xml|\/sport\/.*rss|\/sport\.xml/i;

export function isSportsFeedUrl(feedUrl: string | null | undefined) {
  if (!feedUrl) return false;
  return SPORTS_FEED_RE.test(feedUrl);
}

export function isSportsSource(hint: { handle?: string | null; feedUrl?: string | null }) {
  if (hint.handle && SPORTS_INTEL_HANDLES.has(hint.handle)) return true;
  return isSportsFeedUrl(hint.feedUrl);
}

function defaultSportSubtag(hint: { handle?: string | null; feedUrl?: string | null }) {
  if (hint.handle === "bbc-football") return "soccer";
  const feed = hint.feedUrl ?? "";
  if (/\/sport\/football|football\/rss/i.test(feed)) return "soccer";
  if (/\/nfl\b|\/nfl\//i.test(feed)) return "nfl";
  if (/\/nba\b|\/nba\//i.test(feed)) return "basketball";
  if (/\/mlb\b|\/mlb\//i.test(feed)) return "baseball";
  if (/\/nhl\b|\/nhl\//i.test(feed)) return "hockey";
  return null;
}

/** Sport RSS layers should carry topic sports, not the generic world fallback. */
/** Intel RSS layers in the hazard pack that are official weather/warning feeds. */
export const WEATHER_INTEL_HANDLES = new Set([
  "nws-alerts",
  "met-eireann",
  "metoffice-uk",
  "nhc-atlantic",
]);

const WEATHER_FEED_RE =
  /api\.weather\.gov|alerts\.weather\.gov|met\.ie\/warnings|metoffice\.gov\.uk.*Warnings|nhc\.noaa\.gov|meteoalarm/i;

export function isWeatherSource(hint: { handle?: string | null; feedUrl?: string | null }) {
  if (hint.handle && WEATHER_INTEL_HANDLES.has(hint.handle)) return true;
  const feed = hint.feedUrl ?? "";
  if (WEATHER_FEED_RE.test(feed)) return true;
  return false;
}

/** NWS-style headlines and CAP alert URLs — not cyber advisories. */
export function textLooksLikeOfficialWeatherAlert(text: string) {
  return (
    /\bby nws\b/i.test(text) ||
    /\b(?:flood|flash flood|severe thunderstorm|tornado|hurricane|winter storm|heat|wind|red flag|special weather)\s+(?:advisory|warning|watch)\b/i.test(
      text,
    ) ||
    /api\.weather\.gov\/alerts\//i.test(text)
  );
}

function stripCyberWhenWeatherHeadline(classified: Classification, text: string): Classification {
  if (!textLooksLikeOfficialWeatherAlert(text)) return classified;
  const drop = new Set(["cyber"]);
  const topics = classified.topics.filter((topic) => !drop.has(topic));
  const tags = classified.tags.filter((tag) => !drop.has(tag));
  const withWeather = topics.includes("weather") ? topics : ["weather", ...topics];
  const withWeatherTags = tags.includes("weather") ? tags : ["weather", ...tags];
  return {
    ...classified,
    topics: [...new Set(withWeather)].slice(0, 6),
    tags: [...new Set(withWeatherTags)].slice(0, 8),
  };
}

export function applyWeatherSourceTopics(
  classified: Classification,
  hint: { handle?: string | null; feedUrl?: string | null },
  text = "",
): Classification {
  let next = classified;
  if (isWeatherSource(hint) || textLooksLikeOfficialWeatherAlert(text)) {
    const drop = new Set(["cyber", "world"]);
    const topics = ["weather", ...next.topics.filter((topic) => !drop.has(topic) && topic !== "weather")].slice(
      0,
      6,
    );
    const tags = [...new Set(["weather", ...next.tags.filter((tag) => !drop.has(tag) && tag !== "weather")])].slice(
      0,
      8,
    );
    next = { ...next, topics, tags };
  }
  return stripCyberWhenWeatherHeadline(next, text);
}

export function applySourceTopics(
  classified: Classification,
  hint: { handle?: string | null; feedUrl?: string | null },
): Classification {
  if (!isSportsSource(hint)) return classified;
  const topics = [
    "sports",
    ...classified.topics.filter((topic) => topic !== "sports" && topic !== "world"),
  ].slice(0, 6);
  const inferred = defaultSportSubtag(hint);
  const tags = [
    ...new Set([
      "sports",
      ...classified.tags.filter((tag) => tag !== "world"),
      ...(inferred ? [inferred] : []),
    ]),
  ].slice(0, 8);
  return { ...classified, topics, tags };
}

export function sortStoryTopics(topics: string[]) {
  return [...new Set(topics)].sort((a, b) => {
    if (a === "world") return 1;
    if (b === "world") return -1;
    if (a === "sports") return -1;
    if (b === "sports") return 1;
    return a.localeCompare(b);
  });
}

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
  { name: "Ireland", re: /\b(ireland|irish|dublin|cork|galway|limerick|waterford|shannon|belfast|eire|éire|northern ireland)\b/i },
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
  const subs = sportSubtags(text);
  if (subs.length && !topics.includes("sports")) topics.push("sports");
  if (topics.length === 0) topics.push("world");
  const locations = PLACES.filter(({ re }) => re.test(text)).map(({ name }) => name);
  const tags = [...new Set([...topics, ...subs])];
  return {
    topics: [...new Set(topics)].slice(0, 6),
    locations: [...new Set(locations)].slice(0, 6),
    tags: tags.slice(0, 8),
  };
}

export function classifyText(text: string) {
  return classify(text).tags;
}

export function classifyItem(title: string, summary?: string | null) {
  const text = `${title} ${summary ?? ""}`;
  const base = classify(text);
  return stripCyberWhenWeatherHeadline(base, text);
}

export function textHasTopic(text: string, topic: string) {
  const needle = topic.trim().toLowerCase();
  if (!needle) return true;
  const def = TOPICS.find((entry) => entry.tag === needle);
  if (def) return def.re.test(text);
  const sport = SPORT_SUBTAGS.find((entry) => entry.tag === needle);
  if (sport) return sport.re.test(text);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

const EXTRA_TOPICS = ["reddit"];

export function isKnownTopic(name: string) {
  const needle = name.trim().toLowerCase();
  return TOPICS.some((entry) => entry.tag === needle) || EXTRA_TOPICS.includes(needle);
}

export function knownTopicTags() {
  return [...TOPICS.map((entry) => entry.tag), ...EXTRA_TOPICS];
}

/** Topic tags available in the reclassify menu (stable order). */
export function listClassifyTopics() {
  return knownTopicTags();
}

export function itemHasTopic(
  item: { title: string; summary?: string | null; topics: string[]; tags: string[]; extractText?: string | null },
  topic: string | null,
) {
  if (!topic) return true;
  if (item.topics.includes(topic) || item.tags.includes(topic)) return true;
  return textHasTopic(`${item.title} ${item.summary ?? ""} ${item.extractText ?? ""}`, topic);
}

export function textHasPlace(text: string, place: string) {
  const needle = place.trim().toLowerCase();
  if (!needle) return true;
  const def = PLACES.find((entry) => entry.name.toLowerCase() === needle);
  if (def) return def.re.test(text);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}
