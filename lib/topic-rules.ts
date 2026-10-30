import { INTEL_FEEDS } from "./intel-feeds";

/** Bump when topic or place rules change so stored rows are re-scored (`lib/reclassify-backfill.ts`). */
export const CLASSIFIER_VERSION = 6;

export type Topic =
  | "weather"
  | "quake"
  | "war"
  | "unrest"
  | "conflict"
  | "cyber"
  | "markets"
  | "ai"
  | "tech"
  | "energy"
  | "climate"
  | "health"
  | "politics"
  | "diplomacy"
  | "science"
  | "nuclear"
  | "defense"
  | "disaster"
  | "sports";

export type Signal = {
  re: RegExp;
  /** 3 = decisive alone, 2 = strong, 1 = weak (needs company). */
  weight: 1 | 2 | 3;
  label: string;
};

export type TopicRule = {
  topic: Topic;
  signals: Signal[];
  /** Any match drops the topic unless a weight-3 signal also matched. */
  vetoes?: { re: RegExp; label: string }[];
  threshold?: number;
};

export type TopicHint = {
  handle?: string | null;
  feedUrl?: string | null;
  category?: string | null;
  sourceType?: string | null;
  language?: string | null;
};

export type TopicEvidence = { topic: Topic; score: number; hits: string[] };

const s = (re: RegExp, weight: 1 | 2 | 3, label: string): Signal => ({ re, weight, label });

const THREAT_ACTOR_WEATHER =
  /\b(?:volt|salt|flax|silk|linen|violet|brass|raspberry|granite|aqua)\s+typhoon\b|\b(?:midnight|forest|seashell|secret|star|cadet|ruby)\s+blizzard\b|\b(?:mint|peach|cotton|crimson|lemon|pumpkin)\s+sandstorm\b|\b(?:diamond|jade|emerald|sapphire|onyx|moonstone)\s+sleet\b|\bocto\s+tempest\b|\bstorm-\d{3,4}\b/i;

const TEAM_NICKNAMES =
  /\b(bills|jets|chiefs|commanders|cardinals|giants|eagles|lions|bears|panthers|saints|titans|raiders|rams|falcons|browns|colts|bucks|nets|suns|warriors|ravens|bengals|steelers|packers|cowboys|patriots|dolphins|seahawks|broncos|chargers|vikings|texans|jaguars|49ers|niners|buccaneers|lakers|celtics|knicks|bulls|nuggets|mavericks|yankees|dodgers|red sox|mets|cubs|astros|braves|phillies|padres|mariners)\b/i;

/** School names that are also places. They count only next to a game word, so "Michigan Senate" stays politics. */
const COLLEGE_SCHOOL =
  String.raw`\b(?:michigan|indiana|ohio state|penn state|notre dame|clemson|florida state|lsu|auburn|oklahoma|wisconsin|iowa state|nebraska|michigan state|ole miss|texas a&m|texas tech|oklahoma state|kansas state|west virginia|north carolina|nc state|virginia tech|boston college|boise state|oregon|usc|ucla|byu|tcu|baylor)\b`;
const COLLEGE_CUE =
  String.raw`\b(?:game|scored|scoring|score for|touchdowns?|quarterbacks?|coach|ranked|fans?|qb)\b`;
const COLLEGE_GAME = new RegExp(
  `(?:${COLLEGE_SCHOOL}.{0,80}${COLLEGE_CUE}|${COLLEGE_CUE}.{0,80}${COLLEGE_SCHOOL})`,
  "i",
);

export const TOPIC_RULES: TopicRule[] = [
  {
    topic: "cyber",
    signals: [
      s(/\bCVE-\d{4}-\d{3,7}\b/i, 3, "CVE id"),
      s(/\b(?:ZDI|SVD)-\d{2,4}-\d+\b|\bGHSA-[a-z0-9]{4}-/i, 3, "advisory id"),
      s(/\b(?:zero[- ]day|0[- ]?day)\b/i, 3, "zero-day"),
      s(/\bransomware\b/i, 3, "ransomware"),
      s(/\bmalware\b|\binfostealer\b|\bspyware\b|\bbotnet\b|\btrojan\b|\bbackdoor\b|\bwiper\b/i, 3, "malware"),
      s(/\bphishing\b|\bsmishing\b|\bbusiness email compromise\b/i, 3, "phishing"),
      s(/\bpatch tuesday\b/i, 3, "Patch Tuesday"),
      s(/\bKEV\b|known exploited vulnerabilit/i, 3, "KEV"),
      s(/\bcyber[- ]?attacks?\b|\bcyber ?security\b|\bcybercrim/i, 3, "cyber"),
      s(/\bdata breach\b|\bdata leak\b/i, 3, "data breach"),
      s(/\bthreat actors?\b|\bAPT ?\d{1,3}\b|\bnation[- ]state hackers?\b/i, 3, "threat actor"),
      s(/vuln[ée]rabilit|vulnerabilidad|\bfailles?\b/i, 3, "vulnerability"),
      s(/\bvulnerabilit(?:y|ies)\b/i, 2, "vulnerability"),
      s(/\bexploit(?:s|ed|ing|ation)?\b/i, 2, "exploit"),
      s(
        /\b(?:privilege escalation|remote code execution|command injection|sql injection|path traversal|directory traversal|deserialization|cross-site scripting|xss|ssrf|request forgery|buffer overflow|use-after-free|authentication bypass|information disclosure|denial[- ]of[- ]service|ddos)\b/i,
        2,
        "vulnerability class",
      ),
      s(/\bsecurity (?:advisory|advisories|update|updates|flaw|bug|patch|bulletin)\b/i, 2, "security advisory"),
      s(/\bhack(?:ers?|ed|ing)?\b(?!athon)/i, 2, "hacking"),
      s(/\b(?:ITDR|EDR|XDR|SIEM|SOAR|SOC)\b/, 2, "security tooling"),
      s(/\bCISA\b|\bNCSC\b|\bCERT\b|\bCSIRT\b|\bENISA\b/, 2, "security agency"),
      s(/\bcredentials?\b|\bpasswords?\b|\bencryption\b|\bfirewall\b/i, 1, "security term"),
    ],
    vetoes: [{ re: /\blife ?hacks?\b|\bgrowth hack/i, label: "life hack" }],
  },
  {
    topic: "health",
    signals: [
      s(/\bWHO\b/, 2, "WHO"),
      s(/\bworld health organi[sz]ation\b/i, 3, "World Health Organization"),
      s(
        /\b(?:outbreak|pandemic|epidemic|cholera|measles|mpox|ebola|marburg|dengue|bird flu|avian flu|h5n1|covid|polio|tuberculosis|malaria)\b/i,
        2,
        "disease",
      ),
      s(/\bvaccin(?:e|es|ation)\b/i, 2, "vaccine"),
      s(/\bpublic health\b|\bhealth (?:service|ministry|officials?|emergency)\b|\bNHS\b|\bHSE\b/i, 2, "public health"),
      s(/\bhospitals?\b|\bpatients?\b|\bdoctors?\b|\bnurses?\b/i, 1, "hospital"),
      s(/\bvirus\b/i, 1, "virus"),
    ],
    vetoes: [{ re: /\bcomputer virus\b|\bmalware\b|\bransomware\b|\btrojan\b/i, label: "computer virus" }],
  },
  {
    topic: "war",
    signals: [
      s(/\binvasion\b|\binvaded\b/i, 2, "invasion"),
      s(/\bair ?strikes?\b|\bshelling\b|\bbombardment\b/i, 2, "strike"),
      s(/\bfront ?lines?\b|\bbattlefield\b|\bcounteroffensive\b/i, 2, "front line"),
      s(/\bmissile (?:strike|attack|barrage)s?\b|\bdrone (?:strike|attack)s?\b/i, 2, "missile strike"),
      s(/\bceasefire\b|\bcease-fire\b|\btruce\b/i, 2, "ceasefire"),
      s(/\bwar (?:in|with|against|on (?:ukraine|gaza|iran|israel))\b|\bwartime\b|\bwar crimes?\b/i, 2, "war"),
      s(
        /\b(?:middle east|iran|iranian|ukraine|ukrainian|gaza|israel|israeli|russia|russian|sudan|sudanese|russia-ukraine|israel-hamas|israel-iran|civil|tigray|lebanon|yemen|syrian?|full-blown|all-out|proxy) war\b|\b(?:armed|violent) conflict\b/i,
        2,
        "named war",
      ),
      s(/\bwar\b|\bwarfare\b/i, 1, "war"),
      s(/\boccupation\b|\boccupied\b|\btroops?\b|\bcombat\b|\boffensive\b/i, 1, "military action"),
      s(/\b(?:ukraine|kyiv|kharkiv|donbas|gaza|rafah|sudan|darfur|yemen|lebanon|syria|sahel|myanmar)\b/i, 1, "war zone"),
    ],
    vetoes: [
      {
        re: /\b(?:chip|price|culture|trade|tariff|console|bidding|streaming|talent|flame|turf|patent|currency) wars?\b|\bstar wars\b|\bwar room\b|\bwar on (?:drugs|crime|poverty|waste|terror)\b|\bcombat (?:fraud|scams?|slop|misinformation|disinformation|climate|loneliness|abuse)/i,
        label: "figurative war",
      },
    ],
  },
  {
    topic: "conflict",
    signals: [
      s(/\bair ?strikes?\b|\bshelling\b|\bbombardment\b/i, 2, "strike"),
      s(/\bmissile (?:strike|attack|barrage)s?\b|\bdrone (?:strike|attack)s?\b/i, 2, "missile strike"),
      s(/\bkilled in (?:an? )?(?:attack|strike|fighting|clashes|raid|bombing)\b|\bcasualties\b/i, 2, "casualties"),
      s(/\bsoldiers?\b|\bmilitants?\b|\barmed groups?\b|\binsurgen(?:ts?|cy)\b|\bgunmen\b|\bparamilitar/i, 2, "fighters"),
      s(/\btroops?\b|\bceasefire\b|\bhostages?\b|\bmilitia\b/i, 2, "troops"),
      s(/\bhamas\b|\bhezbollah\b|\bhouthis?\b|\btaliban\b|\bal-shabaab\b|\bislamic state\b|\bwagner group\b|\brapid support forces\b/i, 2, "armed group"),
      s(/\bterror(?:ist|ism)? attack\b|\bsuicide bomb/i, 2, "terror attack"),
      s(/\binvasion\b|\bfront ?lines?\b|\bbattlefield\b/i, 2, "front line"),
      s(/\bfighting\b|\brebels?\b|\bbombings?\b|\bbombed\b|\bmassacre\b|\bgunfire\b|\bshot dead\b|\b(?:armed|violent) conflict\b/i, 2, "fighting"),
      s(/\bkilled\b|\bmissiles?\b|\brockets?\b|\bdrones?\b|\battacks?\b|\bconflict\b|\bwar\b/i, 1, "violence"),
    ],
    vetoes: [
      {
        re: /\bcyber|\bmalware\b|\bransomware\b|\bphishing\b|\bvulnerabilit|\bexploit|\bCVE-|\bhackers?\b|\bbotnet\b|\bddos\b|\bheart attack\b|\bpanic attack\b/i,
        label: "cyber or medical attack",
      },
    ],
  },
  {
    topic: "unrest",
    signals: [
      s(/\bprotest(?:s|ers?|ed|ing)?\b/i, 2, "protest"),
      s(/\briots?\b|\brioting\b|\blooting\b/i, 2, "riot"),
      s(/\bcoup\b|\bmartial law\b|\buprising\b|\bcivil unrest\b|\bcurfew\b|\btear gas\b/i, 2, "unrest"),
      s(/\bclash(?:es|ed)? with (?:police|security forces)\b|\bcrackdown\b/i, 2, "crackdown"),
      s(/\bdemonstrat(?:ion|ors)s?\b|\bclashes\b|\bstrikes? by\b|\bgeneral strike\b/i, 1, "demonstration"),
    ],
  },
  {
    topic: "weather",
    signals: [
      s(/\b(?:storm|blizzard|tornado|cyclone|typhoon|hurricane|thunderstorms?|hailstorm|landfall)\b/i, 2, "storm"),
      s(/\bfloods?\b|\bflooding\b|\bflash flood/i, 2, "flood"),
      s(/\bheat ?waves?\b|\bwildfires?\b|\bdrought\b/i, 2, "heat"),
      s(
        /\b(?:weather|heat|wind|snow|rain|flood|storm|frost|fog|ice|thunderstorm|gale|tornado|hurricane|winter storm|red flag|coastal flood)\s+(?:warning|watch|advisory|alert)s?\b/i,
        3,
        "weather warning",
      ),
      s(/\bnational weather service\b|\bby NWS\b|\bmet (?:office|éireann|eireann)\b|\bmeteoalarm\b/i, 3, "met service"),
      s(/\bsevere weather\b|\bwinter storm\b|\bsnowfall\b|\btemperatures?\b|\bforecast\b/i, 1, "weather"),
    ],
    vetoes: [{ re: THREAT_ACTOR_WEATHER, label: "threat actor name" }],
  },
  {
    topic: "quake",
    signals: [
      s(/\bearthquakes?\b|\bquake\b|\baftershocks?\b/i, 3, "earthquake"),
      s(/\btsunami (?:watch|warning|advisory)\b/i, 3, "tsunami warning"),
      s(/\bmagnitude\b|\bM ?[4-9]\.\d\b|\bseismic\b/i, 2, "magnitude"),
    ],
    vetoes: [{ re: /\bseismic shift\b|\bmagnitude of (?:the|this)\b/i, label: "figurative" }],
  },
  {
    topic: "disaster",
    signals: [
      s(/\b(?:volcan(?:o|ic) eruption|eruption|landslides?|mudslides?|avalanche|famine)\b/i, 2, "disaster"),
      s(/\b(?:building|bridge|mine|dam|stadium) collapse|\bcollapse of (?:a|the) (?:building|bridge|mine|dam)\b/i, 2, "collapse"),
      s(/\bexplosion\b.*\b(?:killed|injured|dead)\b|\b(?:killed|injured)\b.*\bexplosion\b/i, 2, "explosion"),
      s(/\bevacuat(?:e|ed|ion|ions)\b|\bhumanitarian crisis\b|\bdeath toll\b/i, 1, "evacuation"),
      s(/\bearthquakes?\b|\btsunami\b/i, 2, "earthquake"),
    ],
  },
  {
    topic: "climate",
    signals: [
      s(/\bclimate\b|\bglobal warming\b|\bnet[- ]zero\b|\bCOP ?\d{2}\b/i, 2, "climate"),
      s(/\bemissions\b|\bcarbon (?:dioxide|tax|capture|market|credits?)\b|\bgreenhouse gas/i, 2, "emissions"),
      s(/\bdrought\b|\bheat ?waves?\b|\bwildfires?\b|\bsea levels?\b/i, 1, "extreme weather"),
    ],
  },
  {
    topic: "politics",
    signals: [
      s(/\belections?\b|\breferendum\b|\bballots?\b|\bmidterms?\b|\bprimaries\b/i, 2, "election"),
      s(/\bparliament\b|\bCongress\b|\bSenate\b|\blawmakers\b|\blegislat(?:ion|ure|ors)\b|\bMPs\b|\bDáil\b/, 2, "legislature"),
      s(/\bprime minister\b|\bministers?\b|\bchancellor\b|\bgovernor\b|\btaoiseach\b/i, 2, "minister"),
      s(/\bsanctions?\b/i, 2, "sanctions"),
      s(/\b(?:the|a|tax|spending|appropriations?|budget|immigration|health) bills?\b|\bbill (?:passed|passes|vote)\b/i, 2, "bill"),
      s(/\bopposition (?:party|leader)\b|\bcoalition government\b|\bpolitical\b|\bpoliticians?\b/i, 2, "politics"),
      s(/\bpresident\b|\bvot(?:e|es|ers|ing)\b|\bcampaign\b|\bparty\b/i, 1, "president"),
    ],
    vetoes: [{ re: /\b(?:vice )?president of (?:product|engineering|sales|marketing|research)\b/i, label: "job title" }],
  },
  {
    topic: "diplomacy",
    signals: [
      s(/\bUN\b|\bU\.N\.|\bNATO\b/, 2, "UN / NATO"),
      s(/\bunited nations\b|\bsecurity council\b/i, 3, "United Nations"),
      s(/\benvoys?\b|\bembass(?:y|ies)\b|\btreaty\b|\bambassadors?\b|\bdiplomat(?:s|ic)?\b|\bforeign minist(?:er|ry)\b|\bstate department\b/i, 2, "diplomat"),
      s(/\bpeace (?:talks|deal|plan|process)\b|\bbilateral\b|\bG7\b|\bG20\b|\bcounterparts?\b/i, 2, "talks"),
      s(/\bbroker(?:ed|ing)?\b|\bmediat(?:e|ed|ion|or)\b/i, 1, "mediation"),
      s(/\bsummit\b|\btalks\b/i, 1, "summit"),
      s(/\bhosts?\b|\bmeets?\b|\bmet with\b|\bstate visit\b/i, 1, "meeting"),
    ],
  },
  {
    topic: "defense",
    signals: [
      s(/\bPentagon\b|\bDoD\b|\bMoD\b|\bdefen[cs]e (?:ministry|minister|secretary|budget|department|spending|forces|contractor)\b/, 2, "defence ministry"),
      s(/\bair force\b|\bnavy\b|\barmy\b|\bmarines\b|\barmed forces\b|\bmilitary\b/i, 2, "armed forces"),
      s(/\bfighter jets?\b|\bjets scramble|\bscrambled? (?:jets|fighters)\b|\bwarships?\b|\bsubmarines?\b|\bF-\d{2}s?\b|\bbombers\b/i, 2, "jets"),
      s(/\bNATO\b/, 1, "NATO"),
      s(/\bcommanders?\b|\bgenerals?\b|\bchiefs?\b|\bweapons?\b/i, 1, "command"),
    ],
    vetoes: [{ re: /\bnavy blue\b/i, label: "colour" }],
  },
  {
    topic: "nuclear",
    signals: [
      s(/\bnuclear (?:weapons?|warheads?|tests?|program(?:me)?|deal|talks|arsenal|plant|reactor|power|deterrent)\b/i, 3, "nuclear"),
      s(/\bICBMs?\b|\bwarheads?\b|\bnonproliferation\b|\bnon-proliferation\b|\buranium enrichment\b|\bplutonium\b|\bIAEA\b/i, 2, "warhead"),
      s(/\bnuclear\b|\batomic\b/i, 1, "nuclear"),
    ],
  },
  {
    topic: "energy",
    signals: [
      s(/\bOPEC\b|\bcrude (?:oil|prices?|exports?|output)\b|\bbrent\b|\bLNG\b|\bnatural gas\b|\bgas (?:prices?|supply|supplies|pipeline|field)\b|\bgasoline\b/i, 2, "oil and gas"),
      s(/\boil (?:prices?|output|exports?|supply|supplies|field|production|tankers?|markets?|discovery|company|companies|giant|major|deal)\b|\boil and gas\b|\boil-rich\b/i, 2, "oil"),
      s(/\bfuel\b|\boil\b/i, 1, "fuel"),
      s(/\brefiner(?:y|ies)\b|\bpipelines?\b|\bpower grid\b|\bblackouts?\b|\bpower cuts?\b|\belectricity (?:prices|bills|grid)\b/i, 2, "grid"),
      s(/\bnuclear plant\b|\brenewables?\b|\bsolar (?:farm|power|panels)\b|\bwind farms?\b/i, 2, "power"),
    ],
    vetoes: [{ re: /\btear gas\b|\bnerve gas\b|\bgas attack\b/i, label: "tear gas" }],
  },
  {
    topic: "markets",
    signals: [
      s(/\bstocks?\b|\bshares\b|\bnasdaq\b|\bS&P 500\b|\bDow Jones\b|\bFTSE\b|\bstock market\b|\bwall street\b/i, 2, "stocks"),
      s(/\binflation\b|\brecession\b|\bGDP\b|\binterest rates?\b|\bcentral bank\b|\bbond yields?\b|\byields\b/i, 2, "macro"),
      s(/\bFed\b|\bECB\b|\bFederal Reserve\b/, 2, "central bank"),
      s(/\boil prices?\b|\bbitcoin\b|\bcrypto(?:currency)?\b/i, 2, "prices"),
      s(/\b(?:job|labou?r|housing) market\b|\bjobs report\b|\bunemployment\b|\bpayrolls\b/i, 2, "jobs"),
      s(/\bmarkets?\b|\bhiring\b|\btariffs?\b|\btrade war\b/i, 1, "market"),
    ],
    vetoes: [{ re: /\bchristmas markets?\b|\bholiday markets?\b|\bfarmers'? markets?\b|\bflea markets?\b|\bmarket square\b|\bwall street journal\b/i, label: "street market" }],
  },
  {
    topic: "ai",
    signals: [
      s(/\bartificial intelligence\b|\bgenerative AI\b|\bAI-generated\b/i, 3, "AI"),
      s(/\bAI\b/, 2, "AI"),
      s(/\bchatgpt\b|\bopenai\b|\banthropic\b|\bclaude\b|\bgemini\b|\bLLMs?\b|\blarge language models?\b|\bmachine learning\b|\bcopilot\b|\bAI agents?\b|\bdeepfakes?\b/i, 2, "AI model"),
    ],
  },
  {
    topic: "tech",
    signals: [
      s(/\bchip\b|\bchipmakers?\b|\b(?:AI|computer|memory) chips\b|\bsemiconductors?\b|\bprocessors?\b|\bGPUs?\b|\bdata cent(?:er|re)s?\b/i, 2, "chips"),
      s(/\bchips\b/i, 1, "chips"),
      s(/\bsmartphones?\b|\biphone\b|\bandroid\b|\blaptops?\b|\bstartups?\b|\bbrowsers?\b|\bchrome\b|\bfirefox\b|\bsafari\b/i, 2, "devices"),
      s(/\bsoftware\b|\bapps?\b|\bopen[- ]source\b|\bcloud\b|\bwindows\b|\bmacos\b|\blinux\b/i, 1, "software"),
      s(/\bgoogle\b|\bapple\b|\bmicrosoft\b|\bmeta\b|\bamazon\b|\bnvidia\b|\bsamsung\b|\btesla\b/i, 1, "tech company"),
    ],
    vetoes: [{ re: /\bfish and chips\b|\bpoker chips?\b|\bchocolate chips?\b/i, label: "food" }],
  },
  {
    topic: "science",
    signals: [
      s(/\bNASA\b|\bESA\b|\btelescope\b|\bphysicists?\b|\bastronom(?:er|ers|y)\b|\bpeer[- ]reviewed\b|\bquantum\b/i, 2, "science"),
      s(/\bstudy (?:finds|shows|suggests)\b|\bscientists\b|\bresearchers (?:found|say|discover)\b|\bjournal (?:Nature|Science)\b/i, 2, "study"),
      s(/\bspace(?:craft| mission| station|x)\b|\bmars\b|\bthe moon\b|\basteroid\b/i, 2, "space"),
      s(/\bstudy\b|\bresearch\b|\bdiscover(?:y|ed)\b/i, 1, "research"),
    ],
  },
  {
    topic: "sports",
    signals: [
      s(
        /\b(?:premier league|champions league|europa league|conference league|la liga|serie a|bundesliga|ligue 1|eredivisie|fa cup|carabao cup|world cup|six nations|super bowl|formula (?:1|one)|grand prix|grand slam|wimbledon|olympics|paralympics|tour de france|motogp|ryder cup|stanley cup|world series|march madness|all[- ]ireland|heineken cup|pga tour|miami heat)\b/i,
        3,
        "competition",
      ),
      s(/\b(?:NFL|NBA|MLB|NHL|MLS|WNBA|UEFA|FIFA|GAA|IPL|ATP|WTA|NCAA|UFC)\b/, 3, "league"),
      s(/\b(?:football|soccer|rugby|cricket|tennis|hurling|camogie|basketball|baseball|ice hockey|boxing)\b/i, 2, "sport"),
      s(/\b(?:quarterback|touchdown|goalkeeper|midfielder|hat[- ]trick|match report|full[- ]time|half[- ]time|penalty shoot-?out|transfer window|wicket|innings)\b/i, 2, "match"),
      s(/\b(?:offensive|defensive|special teams) coordinators?\b/i, 2, "coordinator"),
      s(/\bnewspaper agate\b/i, 2, "sports page"),
      s(COLLEGE_GAME, 2, "college game"),
      s(/\bQB\b/, 2, "match"),
      s(/\b(?:manchester united|man united|man city|manchester city|liverpool|arsenal|chelsea|tottenham|spurs|real madrid|barcelona|bayern|psg|juventus|inter milan|ac milan|benfica|celtic|rangers)\b/i, 2, "club"),
      s(TEAM_NICKNAMES, 1, "team"),
      s(/\b(?:striker|defender|golf|cycling|athletics|marathon|coach|playoffs?|season opener)\b/i, 1, "sport word"),
    ],
  },
];

const SPORTS_HANDLES = new Set(["bbc-sport", "bbc-football", "guardian-sport", "espn", "nyt-sports", "sky-sports"]);
const SPORTS_FEED_RE =
  /feeds\.bbci\.co\.uk\/sport|theguardian\.com\/sport|espn\.com\/espn|skysports\.com|nyt.*Sports\.xml|\/sport\/.*rss|\/sport\.xml/i;
const WEATHER_HANDLES = new Set(["nws-alerts", "met-eireann", "metoffice-uk", "nhc-atlantic"]);
const WEATHER_FEED_RE =
  /api\.weather\.gov|alerts\.weather\.gov|met\.ie\/warnings|metoffice\.gov\.uk.*Warnings|nhc\.noaa\.gov|meteoalarm/i;
const QUAKE_FEED_RE = /earthquake\.usgs\.gov|emsc-csem/i;
/** Cyber layers inside the security pack; the pack also carries defence and think-tank outlets. */
const CYBER_INTEL_IDS = new Set([
  "cisa",
  "cisa-ics",
  "krebs",
  "bleeping",
  "therecord",
  "ncsc",
  "csirts-kev",
  "cccs",
  "schneier",
  "hacker-news",
  "darkreading",
  "msrc",
  "cert-eu",
]);
const SECURITY_HANDLES = new Set(
  INTEL_FEEDS.filter((feed) => feed.pack === "security" && CYBER_INTEL_IDS.has(feed.id)).map((feed) => feed.id),
);
const SECURITY_TYPES = new Set(["cert", "vendor", "research"]);
const SECURITY_CATEGORY_RE =
  /secur|cert|vulnerab|threat|endpoint|edr|siem|firewall|privileged|identity|email security|devops|malware|advisor|exploit/i;
const SECURITY_FEED_RE =
  /cisa\.gov|ncsc\.|cert\.|csirt|isc\.sans|krebsonsecurity|bleepingcomputer|thehackernews|darkreading|securityweek|therecord\.media|zerodayinitiative|msrc|talosintelligence|unit42|mandiant|threatpost|schneier|welivesecurity|sophos|crowdstrike|sentinelone|rapid7|tenable|qualys|splunk.*advis/i;

export function isSportsHint(hint?: TopicHint | null) {
  if (!hint) return false;
  if (hint.handle && SPORTS_HANDLES.has(hint.handle)) return true;
  if (hint.feedUrl && SPORTS_FEED_RE.test(hint.feedUrl)) return true;
  return Boolean(hint.category && /\bsports?\b/i.test(hint.category));
}

export function isWeatherHint(hint?: TopicHint | null) {
  if (!hint) return false;
  if (hint.handle && WEATHER_HANDLES.has(hint.handle)) return true;
  return Boolean(hint.feedUrl && WEATHER_FEED_RE.test(hint.feedUrl));
}

export function isSecurityHint(hint?: TopicHint | null) {
  if (!hint) return false;
  if (hint.sourceType && SECURITY_TYPES.has(hint.sourceType)) return true;
  if (hint.handle && SECURITY_HANDLES.has(hint.handle)) return true;
  if (hint.category && SECURITY_CATEGORY_RE.test(hint.category)) return true;
  return Boolean(hint.feedUrl && SECURITY_FEED_RE.test(hint.feedUrl));
}

const NON_ENGLISH_MARKERS =
  /(?<![\p{L}])(?:dans|vulnérabilités?|multiples|avec|pour les|sur les|de la|que|los|las|para|una|según|también|und|für|nicht|mit|einer)(?![\p{L}])/giu;

function isEnglish(text: string, hint?: TopicHint | null) {
  if (hint?.language) return hint.language.toLowerCase().startsWith("en");
  const hits = new Set((text.match(NON_ENGLISH_MARKERS) ?? []).map((hit) => hit.toLowerCase()));
  return hits.size < 2;
}

const SECURITY_DAMPED: Topic[] = ["sports", "health", "conflict", "war", "science", "defense", "diplomacy"];

/** Score every topic for a title + summary. Title matches count 1.5×. */
export function scoreTopics(
  title: string,
  summary: string | null | undefined,
  hint?: TopicHint | null,
): TopicEvidence[] {
  const body = summary ?? "";
  const all = `${title} ${body}`;
  const english = isEnglish(all, hint);
  const security = isSecurityHint(hint);
  const sports = isSportsHint(hint);
  const weather = isWeatherHint(hint);
  const quakeFeed = Boolean(hint?.feedUrl && QUAKE_FEED_RE.test(hint.feedUrl));
  const out: TopicEvidence[] = [];

  for (const rule of TOPIC_RULES) {
    let raw = 0;
    let decisive = false;
    const hits: string[] = [];
    for (const signal of rule.signals) {
      if (signal.weight === 1 && !english) continue;
      const inTitle = signal.re.test(title);
      const inBody = !inTitle && signal.re.test(body);
      if (!inTitle && !inBody) continue;
      raw += signal.weight * (inTitle ? 1.5 : 1);
      if (signal.weight === 3) decisive = true;
      if (!hits.includes(signal.label)) hits.push(signal.label);
    }
    if (rule.topic === "sports" && sports) {
      raw += 2;
      hits.push("sports source");
    }
    if (rule.topic === "weather" && weather) {
      raw += 2;
      hits.push("weather service");
    }
    if (rule.topic === "quake" && quakeFeed) {
      raw += 2;
      hits.push("quake feed");
    }
    if (rule.topic === "cyber" && security) {
      raw += 2;
      hits.push("security source");
    }
    if (security && !decisive && SECURITY_DAMPED.includes(rule.topic)) raw -= 2;
    if (!raw || !hits.length) continue;
    const vetoed = !decisive && rule.vetoes?.some((veto) => veto.re.test(all));
    const score = Math.floor(raw);
    if (vetoed || score < (rule.threshold ?? 2)) continue;
    out.push({ topic: rule.topic, score, hits });
  }

  return out.sort((a, b) => b.score - a.score);
}

/** Sport league chips. Only applied when the item is already sports. */
export const SPORT_SUBTAGS: { tag: string; re: RegExp }[] = [
  {
    tag: "soccer",
    re: /\b(soccer|premier league|champions league|la liga|serie a|bundesliga|ligue 1|eredivisie|mls|uefa|fifa|world cup|euro 202\d|fa cup|carabao cup|europa league|conference league|ucl|epl|penalty shoot|offside|striker|goalkeeper|midfielder|manchester united|man united|manchester city|man city|liverpool|arsenal|chelsea|tottenham|spurs|real madrid|barcelona|bayern|psg|juventus|inter milan|ac milan|benfica|messi|ronaldo|haaland|salah|var decision)\b/i,
  },
  {
    tag: "nfl",
    re: /\b(nfl|super bowl|touchdown|quarterback|qb|linebacker|wide receiver|tight end|field goal|pro bowl|nfc|afc|patriots|cowboys|chiefs|eagles|49ers|niners|packers|ravens|bills|dolphins|steelers|giants|jets|browns|bengals|lions|vikings|texans|colts|jaguars|titans|broncos|raiders|chargers|rams|seahawks|cardinals|saints|falcons|panthers|buccaneers|commanders|bears)\b/i,
  },
  {
    tag: "rugby",
    re: /\b(rugby|six nations|premiership rugby|urc|gallagher premiership|scrum|lineout|all blacks|springboks|leinster|munster|ulster rugby|connacht)\b/i,
  },
  { tag: "cricket", re: /\b(cricket|ashes|test match|odi|t20|ipl|wicket|county championship|the hundred)\b/i },
  {
    tag: "tennis",
    re: /\b(tennis|wimbledon|roland garros|french open|us open|australian open|atp|wta|davis cup|billie jean king cup)\b/i,
  },
  { tag: "golf", re: /\b(golf|pga tour|masters tournament|ryder cup|open championship|british open|lpga)\b/i },
  { tag: "f1", re: /\b(formula 1|formula one|f1|grand prix|motogp|moto gp)\b/i },
  {
    tag: "basketball",
    re: /\b(nba|basketball|march madness|wnba|lakers|celtics|warriors|knicks|bulls|miami heat|bucks|nuggets|suns|mavericks)\b/i,
  },
  {
    tag: "baseball",
    re: /\b(mlb|baseball|world series|home run|pitcher|yankees|dodgers|red sox|mets|cubs|astros|braves|phillies|padres|mariners)\b/i,
  },
  { tag: "hockey", re: /\b(nhl|ice hockey|stanley cup)\b/i },
  { tag: "gaa", re: /\b(gaa|hurling|camogie|all[- ]ireland|gaelic football|croke park)\b/i },
];

/** Finer chips under a parent topic. */
export const TOPIC_SUBTAGS: { tag: string; parent: Topic; re: RegExp }[] = [
  { tag: "ransomware", parent: "cyber", re: /\bransomware\b/i },
  { tag: "kev", parent: "cyber", re: /\bKEV\b|known exploited vulnerabilit/i },
  { tag: "phishing", parent: "cyber", re: /\bphishing\b|\bsmishing\b/i },
  { tag: "zero-day", parent: "cyber", re: /\bzero[- ]day\b|\b0[- ]?day\b/i },
  { tag: "data-breach", parent: "cyber", re: /\bdata (?:breach|leak)\b|\bbreached\b/i },
  { tag: "supply-chain", parent: "cyber", re: /\bsupply[- ]chain (?:attack|compromise)\b|\bmalicious (?:package|npm|pypi)\b/i },
  { tag: "ddos", parent: "cyber", re: /\bddos\b|\bdenial[- ]of[- ]service\b/i },
  { tag: "flood", parent: "weather", re: /\bfloods?\b|\bflooding\b/i },
  { tag: "wildfire", parent: "weather", re: /\bwildfires?\b|\bbushfires?\b/i },
  { tag: "storm", parent: "weather", re: /\bstorm\b|\bhurricane\b|\btyphoon\b|\bcyclone\b|\btornado\b|\bgale\b/i },
  { tag: "heat", parent: "weather", re: /\bheat ?waves?\b|\bheat (?:warning|advisory)\b|\bextreme heat\b/i },
  { tag: "tsunami", parent: "quake", re: /\btsunami\b/i },
  { tag: "volcano", parent: "disaster", re: /\bvolcan(?:o|ic)\b|\beruption\b/i },
  { tag: "election", parent: "politics", re: /\belections?\b|\breferendum\b/i },
  { tag: "sanctions", parent: "politics", re: /\bsanctions?\b/i },
];

export function topicSubtags(text: string, topics: string[]): string[] {
  const out: string[] = [];
  if (topics.includes("sports")) {
    for (const entry of SPORT_SUBTAGS) if (entry.re.test(text)) out.push(entry.tag);
  }
  for (const entry of TOPIC_SUBTAGS) {
    if (topics.includes(entry.parent) && entry.re.test(text)) out.push(entry.tag);
  }
  return out;
}

export function knownSubtagNames() {
  return [...SPORT_SUBTAGS.map((entry) => entry.tag), ...TOPIC_SUBTAGS.map((entry) => entry.tag)];
}

export function topicRuleNames(): Topic[] {
  return TOPIC_RULES.map((rule) => rule.topic);
}
