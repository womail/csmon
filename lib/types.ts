export type Platform = "bluesky" | "rss" | "web";
export type SourceKind = "account" | "feed" | "site";
export type OriginReason = "self" | "follow" | "mention" | "link" | "intel" | "explore" | "reddit";

export type SeedUser = {
  id: number;
  handle: string;
  platform: Platform;
  did: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  description: string | null;
  profileUrl: string;
  lastScrapedAt: number | null;
  createdAt: number;
};

export type Source = {
  id: number;
  key: string;
  name: string;
  handle: string | null;
  url: string;
  feedUrl: string | null;
  platform: Platform;
  kind: SourceKind;
  description: string | null;
  avatarUrl: string | null;
  color: string;
  enabled: boolean;
  lastFetchedAt: number | null;
  createdAt: number;
  origins: { reason: OriginReason; weight: number; seedHandle: string }[];
};

export type Item = {
  id: number;
  sourceId: number;
  externalId: string;
  title: string;
  summary: string | null;
  url: string;
  author: string | null;
  publishedAt: number | null;
  tags: string[];
  topics: string[];
  locations: string[];
  fetchedAt: number;
};

export type DiscoveredSource = {
  key: string;
  name: string;
  handle: string | null;
  url: string;
  feedUrl: string | null;
  platform: Platform;
  kind: SourceKind;
  description: string | null;
  avatarUrl: string | null;
  reason: OriginReason;
  weight: number;
  sample?: string;
};

export type ScrapedItem = {
  externalId: string;
  title: string;
  summary: string | null;
  url: string;
  author: string | null;
  publishedAt: number | null;
  tags: string[];
  topics: string[];
  locations: string[];
};

export type ScrapeResult = {
  user: {
    handle: string;
    platform: Platform;
    did: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    description: string | null;
    profileUrl: string;
  };
  sources: DiscoveredSource[];
  items: ScrapedItem[];
};

export type SourceHint = {
  host: string;
  url: string;
  count: number;
  sample: string;
  feedUrl: string | null;
};

import type { KevEntry } from "./kev";

export type CacheStats = {
  entries: number;
  bytes: number;
};

export type MonitorState = {
  users: SeedUser[];
  sources: Source[];
  items: Item[];
  hints: SourceHint[];
  kev: KevEntry[];
  cache: CacheStats;
};

export type TimeRange = "1h" | "6h" | "24h" | "7d" | "all";
export const BUILTIN_DESKS = [
  "home",
  "brief",
  "scan",
  "pulse",
  "weather",
  "people",
  "documents",
  "reports",
  "flights",
  "advisories",
  "patch",
  "sources",
] as const;

export type BuiltinDesk = (typeof BUILTIN_DESKS)[number];
export type Desk = BuiltinDesk | `c-${string}`;
export type ConsumeMode = Desk;

export function isBuiltinDesk(id: string): id is BuiltinDesk {
  return (BUILTIN_DESKS as readonly string[]).includes(id);
}

export function isDeskId(id: string): id is Desk {
  return isBuiltinDesk(id) || id.startsWith("c-");
}
