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
  status: "data" | "cached" | "empty" | "never" | "stale" | "disabled";
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
  };
  cacheByKind: CacheKindRow[];
  gdeltCache: { entries: number; bytes: number; articles: number };
  origins: OriginRow[];
  gdelt: GdeltLayerStats[];
};
