export type IntelFeed = {
  id: string;
  name: string;
  url: string;
  feedUrl: string;
  pack: "core" | "relief" | "security";
  blurb: string;
};

export const INTEL_FEEDS: IntelFeed[] = [
  {
    id: "bbc-world",
    name: "BBC World",
    url: "https://www.bbc.com/news/world",
    feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml",
    pack: "core",
    blurb: "Global desk",
  },
  {
    id: "guardian-world",
    name: "Guardian World",
    url: "https://www.theguardian.com/world",
    feedUrl: "https://www.theguardian.com/world/rss",
    pack: "core",
    blurb: "World news",
  },
  {
    id: "nyt-world",
    name: "NYT World",
    url: "https://www.nytimes.com/section/world",
    feedUrl: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    pack: "core",
    blurb: "World RSS",
  },
  {
    id: "npr-world",
    name: "NPR World",
    url: "https://www.npr.org/sections/world/",
    feedUrl: "https://feeds.npr.org/1004/rss.xml",
    pack: "core",
    blurb: "World desk",
  },
  {
    id: "aljazeera",
    name: "Al Jazeera",
    url: "https://www.aljazeera.com",
    feedUrl: "https://www.aljazeera.com/xml/rss/all.xml",
    pack: "core",
    blurb: "International",
  },
  {
    id: "reliefweb",
    name: "ReliefWeb",
    url: "https://reliefweb.int",
    feedUrl: "https://reliefweb.int/updates/rss.xml",
    pack: "relief",
    blurb: "Humanitarian",
  },
  {
    id: "un-news",
    name: "UN News",
    url: "https://news.un.org",
    feedUrl: "https://news.un.org/feed/subscribe/en/news/all/rss.xml",
    pack: "relief",
    blurb: "UN wire",
  },
  {
    id: "who",
    name: "WHO news",
    url: "https://www.who.int",
    feedUrl: "https://www.who.int/rss-feeds/news-english.xml",
    pack: "relief",
    blurb: "Health",
  },
  {
    id: "usgs",
    name: "USGS quakes",
    url: "https://earthquake.usgs.gov",
    feedUrl: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.atom",
    pack: "relief",
    blurb: "Significant quakes",
  },
  {
    id: "cisa",
    name: "CISA alerts",
    url: "https://www.cisa.gov",
    feedUrl: "https://www.cisa.gov/cybersecurity-advisories/all.xml",
    pack: "security",
    blurb: "Cyber advisories",
  },
  {
    id: "bellingcat",
    name: "Bellingcat",
    url: "https://www.bellingcat.com",
    feedUrl: "https://www.bellingcat.com/feed/",
    pack: "security",
    blurb: "Open-source investigations",
  },
  {
    id: "cfr",
    name: "CFR",
    url: "https://www.cfr.org",
    feedUrl: "https://www.cfr.org/rss.xml",
    pack: "security",
    blurb: "Foreign affairs",
  },
];
