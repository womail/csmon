export type CacheKindRow = {
  kind: string;
  entries: number;
  bytes: number;
};

export type OriginRow = {
  reason: string;
  layers: number;
  enabled: number;
  items: number;
  itemsLast24h: number;
};

export type IngestLayerStatus = "data" | "cached" | "empty" | "never" | "stale" | "disabled";

export type GdeltLayerStats = {
  id: number;
  key: string;
  name: string;
  enabled: boolean;
  query: string | null;
  itemCount: number;
  itemsLast24h: number;
  latestTitle: string | null;
  latestAt: number | null;
  lastFetchedAt: number | null;
  cacheArticles: number | null;
  cacheBytes: number | null;
  cacheExpiresAt: number | null;
  status: IngestLayerStatus;
};

export type AcledLayerStats = {
  id: number;
  key: string;
  name: string;
  enabled: boolean;
  country: string | null;
  days: number;
  limit: number;
  itemCount: number;
  itemsLast24h: number;
  latestTitle: string | null;
  latestAt: number | null;
  lastFetchedAt: number | null;
  cacheEvents: number | null;
  cacheBytes: number | null;
  cacheExpiresAt: number | null;
  status: IngestLayerStatus;
};

export type AcledProbeStats = {
  at: number;
  usernameLooksLikeEmail: boolean;
  tokenHttp: number | null;
  tokenError: string | null;
  readHttp: number | null;
  readMessage: string | null;
  apiAccessDenied: boolean;
  hint: string;
};

export type AcledAuthStats = {
  configured: boolean;
  tokenCached: boolean;
  tokenExpiresAt: number | null;
  lastError: string | null;
  probe: AcledProbeStats | null;
};

export type SystemStats = {
  generatedAt: number;
  dataDir: string;
  dbBytes: number;
  boardItemLimit: number;
  totals: {
    items: number;
    sources: number;
    sourcesEnabled: number;
    extracts: number;
    extractBytes: number;
    cacheEntries: number;
    cacheBytes: number;
    gdeltLayers: number;
    gdeltItems: number;
    gdeltItemsLast24h: number;
    acledLayers: number;
    acledItems: number;
    acledItemsLast24h: number;
  };
  cacheByKind: CacheKindRow[];
  gdeltCache: { entries: number; bytes: number; articles: number };
  acledCache: { entries: number; bytes: number; events: number };
  acledAuth: AcledAuthStats;
  origins: OriginRow[];
  gdelt: GdeltLayerStats[];
  acled: AcledLayerStats[];
};
