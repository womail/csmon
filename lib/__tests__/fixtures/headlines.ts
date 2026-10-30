export type HeadlineCase = {
  title: string;
  summary?: string;
  /** Layer hints, when the source should influence the answer. */
  source?: { handle?: string; feedUrl?: string; category?: string; sourceType?: string };
  /** Topics that must be present. */
  topics: string[];
  /** Topics that must be absent. */
  notTopics?: string[];
  places?: string[];
  notPlaces?: string[];
};

export const HEADLINES: HeadlineCase[] = [
  {
    title: "SVD-2026-0614: OS Command Injection in the btool Configuration Helper in Splunk AI Toolkit",
    topics: ["cyber"],
    notTopics: ["health", "conflict"],
  },
  { title: "Patch Tuesday - October 2026", topics: ["cyber"], notTopics: ["health"] },
  {
    title: "Introducing ITDR Lookback: Find Out Who Was in Your Microsoft 365 Tenant Before You Were",
    topics: ["cyber"],
    notTopics: ["health"],
  },
  { title: "WHO declares mpox outbreak a public health emergency", topics: ["health"] },
  {
    title: "World Health Organization warns of cholera spread in Sudan",
    topics: ["health"],
    places: ["Sudan"],
  },
  {
    title:
      "ZDI-26-751: Microsoft Windows dxgkrnl Time-Of-Check Time-Of-Use Local Privilege Escalation Vulnerability",
    topics: ["cyber"],
    notTopics: ["conflict", "war"],
  },
  {
    title: "Defender Exclusion Abuse: How Attackers Hide Malware from MDAV",
    topics: ["cyber"],
    notTopics: ["sports", "conflict"],
  },
  {
    title: "Knicks employees to get NBA championship rings after phishing email 'mistake'",
    topics: ["sports", "cyber"],
  },
  {
    title: "Arsenal join Man City at Premier League summit, Spurs shock Chelsea 2-0",
    topics: ["sports"],
    notTopics: ["diplomacy"],
  },
  {
    title: "Vulnérabilité dans Ivanti Connect Secure (ICS) (14 octobre 2026)",
    topics: ["cyber"],
    notTopics: ["diplomacy"],
  },
  {
    title: "Multiples vulnérabilités dans Citrix NetScaler ADC et Gateway",
    topics: ["cyber"],
    notTopics: ["diplomacy"],
  },
  {
    title: "UN Security Council meets on Gaza ceasefire",
    topics: ["diplomacy", "war"],
    places: ["Gaza"],
  },
  { title: "The Endless Chip War", topics: ["tech"], notTopics: ["war", "conflict"] },
  {
    title: "Etsy to restrict AI-generated content in effort to combat seller slop",
    topics: ["ai"],
    notTopics: ["war", "conflict"],
  },
  {
    title: "The multi-layered defenses that harden Chrome against abusive notifications",
    topics: ["tech"],
    notTopics: ["war", "defense"],
  },
  {
    title: "Russian airstrike hits Kharkiv apartment block",
    topics: ["war", "conflict"],
    places: ["Ukraine", "Russia"],
  },
  {
    title: "Ravens rule out QB Jackson (ankle) Sunday vs. Bengals; Huntley to start",
    topics: ["sports"],
  },
  {
    title: "Senate passes appropriations bills as Jets scramble over Taiwan Strait",
    topics: ["politics", "defense"],
    notTopics: ["sports"],
    places: ["Taiwan"],
  },
  {
    title: "Army chiefs and commanders meet at NATO summit",
    topics: ["defense", "diplomacy"],
    notTopics: ["sports"],
  },
  {
    title: "Cardinals gather in Rome to elect new pope",
    topics: [],
    notTopics: ["sports"],
    places: ["Italy"],
  },
  {
    title: "Heat warning issued for Phoenix as temperatures top 115F",
    topics: ["weather"],
    notTopics: ["sports"],
  },
  { title: "Miami Heat beat Celtics in overtime", topics: ["sports"], notTopics: ["weather"] },
  {
    title: "Michigan was never going to win that game with their current offensive coordinator.",
    topics: ["sports"],
    notTopics: ["politics", "defense"],
  },
  {
    title: "No game has deserved to end in a tie more than this Michigan-Indiana one",
    topics: ["sports"],
  },
  {
    title: "Defense really needs to score for Michigan.",
    topics: ["sports"],
    notTopics: ["defense"],
  },
  { title: "This game could have been newspaper agate.", topics: ["sports"] },
  {
    title: "Key takeaways from US Senate debate in Michigan",
    topics: ["politics"],
    notTopics: ["sports"],
  },
  { title: "Ok that's it fire him", topics: [] },
  { title: "Job market cools as hiring slows", topics: ["markets"] },
  {
    title: "Christmas market reopens in Berlin",
    topics: [],
    notTopics: ["markets"],
    places: ["Germany"],
  },
  { title: "Study finds microplastics in clouds", topics: ["science"] },
  {
    title: "Protesters clash with police in Nairobi over tax bill",
    topics: ["unrest", "politics"],
  },
  { title: "Apple unveils M6 chip", topics: ["tech"] },
  { title: "Tear gas fired at protesters in Tbilisi", topics: ["unrest"], notTopics: ["energy"] },
  { title: "OPEC+ agrees output cut as oil prices slide", topics: ["energy", "markets"] },
  {
    title: "ISC Stormcast For Friday, October 16th, 2026",
    summary: "Tell us what you think of today's podcast",
    source: { feedUrl: "https://isc.sans.edu/rssfeed_full.xml", sourceType: "research" },
    topics: ["cyber"],
    notPlaces: ["US"],
  },
  {
    title: "U.S. imposes new sanctions on Iranian oil exports",
    topics: ["politics", "energy"],
    places: ["US", "Iran"],
  },
  {
    title: "Java deserialization flaw in Apache Commons",
    topics: ["cyber"],
    notPlaces: ["Indonesia"],
  },
  { title: "Hamas says talks stalled", topics: ["conflict"], places: ["Gaza"] },
  {
    title: "Turkey prices rise ahead of Thanksgiving",
    topics: [],
    notPlaces: ["Turkey"],
  },
  {
    title: "Erdogan hosts Putin for summit in Ankara",
    topics: ["diplomacy"],
    places: ["Turkey"],
    notPlaces: ["Russia"],
  },
  {
    title: "Shannon Sharpe signs new podcast deal",
    topics: [],
    notPlaces: ["Ireland"],
  },
  {
    title: "Flights diverted from Shannon Airport after storm",
    topics: ["weather"],
    places: ["Ireland"],
  },
  {
    title: "Strait of Hormuz tanker seized",
    topics: [],
    places: ["Hormuz"],
    notPlaces: ["Taiwan"],
  },
  {
    title: "Putin warns West over long-range missiles",
    topics: [],
    places: ["Russia"],
  },
  {
    title: "Putin speaks in Beijing on trade",
    topics: [],
    places: ["China"],
    notPlaces: ["Russia"],
  },
  {
    title: "Chelsea sign striker from Benfica",
    source: { handle: "bbc-football" },
    topics: ["sports"],
  },
  {
    title: "New research on infostealer campaigns targeting developers",
    source: { sourceType: "vendor", category: "Endpoint & EDR Vendors" },
    topics: ["cyber"],
    notTopics: ["science"],
  },
];
