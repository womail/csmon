import type { IntelFeed } from "./intel-feeds";
import type { OriginReason, Platform, SourceKind } from "./types";

export type SourceCatalogRow = {
  id: number;
  key: string;
  name: string;
  handle: string | null;
  url: string;
  feedUrl: string | null;
  platform: Platform;
  kind: SourceKind;
  description: string | null;
  enabled: boolean;
  lastFetchedAt: number | null;
  createdAt: number;
  retentionDays: number | null;
  origins: { reason: OriginReason; weight: number; seedHandle: string }[];
  intelFeed: IntelFeed | null;
  itemCount: number;
  itemsLast24h: number;
  latestItemAt: number | null;
  latestTitle: string | null;
  stale: boolean;
  silent: boolean;
  primaryReason: OriginReason | "unknown";
};

export type SourceCatalogSummary = {
  total: number;
  enabled: number;
  stale: number;
  silent: number;
  itemsLast24h: number;
  notInShippedCatalog: number;
  suggestions: string[];
  purgePreviewCount?: number;
};

export type FeedOverrideStats = {
  path: string;
  count: number;
  updatedAt: string | null;
  shippedCount: number;
  effectiveCount: number;
};

export type SourceCatalog = {
  rows: SourceCatalogRow[];
  summary: SourceCatalogSummary;
  shippedFeedCount: number;
  feedOverrides?: FeedOverrideStats;
};

export type SourcePatch = {
  id: number;
  name?: string;
  url?: string;
  feedUrl?: string | null;
  description?: string | null;
  enabled?: boolean;
  retentionDays?: number | null;
};

export type CreateSourceInput = {
  name: string;
  url: string;
  feedUrl: string;
  description?: string | null;
  enabled?: boolean;
  retentionDays?: number | null;
};
