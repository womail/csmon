import type { IntelPack } from "./intel-feeds";
import type { SourceCatalogRow } from "./source-catalog-shared";

export const SOURCE_LIBRARY_KEY = "csmon.source-library";
export const SOURCE_LIBRARY_SCHEMA = "csmon-source-contribution/1";

export type LocalSourceDraft = {
  id: number;
  key: string;
  name: string;
  url: string;
  feedUrl: string | null;
  description: string | null;
  enabled: boolean;
  intelId: string | null;
  pack: IntelPack | null;
  notes: string;
  primaryReason: string;
  retentionDays: number | null;
};

export type SourceLibraryFile = {
  schema: typeof SOURCE_LIBRARY_SCHEMA;
  exportedAt: string;
  readme: string;
  feeds: {
    id: string;
    name: string;
    url: string;
    feedUrl: string;
    pack: IntelPack;
    blurb: string;
    notes?: string;
  }[];
  customLayers: {
    key: string;
    name: string;
    url: string;
    feedUrl: string | null;
    description: string | null;
    reason: string;
    notes?: string;
  }[];
};

export function rowToDraft(row: SourceCatalogRow, notes = ""): LocalSourceDraft {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    url: row.url,
    feedUrl: row.feedUrl,
    description: row.description,
    enabled: row.enabled,
    intelId: row.intelFeed?.id ?? row.handle,
    pack: row.intelFeed?.pack ?? null,
    notes,
    primaryReason: row.primaryReason,
    retentionDays: row.retentionDays ?? null,
  };
}

export function loadSourceLibrary(): Record<number, LocalSourceDraft> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SOURCE_LIBRARY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { drafts?: LocalSourceDraft[] };
    const map: Record<number, LocalSourceDraft> = {};
    for (const draft of parsed.drafts ?? []) {
      if (draft?.id) map[draft.id] = draft;
    }
    return map;
  } catch {
    return {};
  }
}

export function saveSourceLibrary(drafts: LocalSourceDraft[]) {
  window.localStorage.setItem(
    SOURCE_LIBRARY_KEY,
    JSON.stringify({ savedAt: Date.now(), drafts }),
  );
}

export function buildContributionFile(
  drafts: LocalSourceDraft[],
  repo = "womail/csmon",
): SourceLibraryFile {
  const feeds: SourceLibraryFile["feeds"] = [];
  const customLayers: SourceLibraryFile["customLayers"] = [];

  for (const draft of drafts) {
    if (draft.feedUrl && draft.pack && draft.intelId) {
      feeds.push({
        id: draft.intelId,
        name: draft.name,
        url: draft.url,
        feedUrl: draft.feedUrl,
        pack: draft.pack,
        blurb: draft.description?.trim() || draft.name,
        notes: draft.notes.trim() || undefined,
      });
    } else if (draft.feedUrl || draft.key.startsWith("rss:")) {
      customLayers.push({
        key: draft.key,
        name: draft.name,
        url: draft.url,
        feedUrl: draft.feedUrl,
        description: draft.description,
        reason: draft.primaryReason,
        notes: draft.notes.trim() || undefined,
      });
    }
  }

  return {
    schema: SOURCE_LIBRARY_SCHEMA,
    exportedAt: new Date().toISOString(),
    readme:
      `Contribution export from csmon. Merge intel feeds into lib/intel-feeds.ts on github.com/${repo}, ` +
      "or attach this JSON to an issue. csmon does not push to GitHub for you.",
    feeds,
    customLayers,
  };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
