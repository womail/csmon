/** Parse Import JSON files (export format, drafts, or plain layer lists). */
import {
  SOURCE_LIBRARY_SCHEMA,
  type LocalSourceDraft,
  type SourceLibraryFile,
} from "./source-library";
import type { CreateSourceInput } from "./source-catalog-shared";

export type ParsedSourceImport = {
  layers: CreateSourceInput[];
  warnings: string[];
};

function pushLayer(
  out: CreateSourceInput[],
  seen: Set<string>,
  warnings: string[],
  raw: Record<string, unknown>,
  label: string,
) {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  const feedUrl =
    typeof raw.feedUrl === "string"
      ? raw.feedUrl.trim()
      : typeof raw.url === "string" && String(raw.url).includes("/feed")
        ? url
        : "";
  if (!name || !url || !feedUrl) {
    warnings.push(`Skipped ${label}: need name, site URL, and feed URL.`);
    return;
  }
  const key = feedUrl.toLowerCase();
  if (seen.has(key)) {
    warnings.push(`Skipped duplicate feed URL (${name}).`);
    return;
  }
  seen.add(key);
  const retentionDays =
    raw.retentionDays === null || raw.retentionDays === undefined
      ? null
      : typeof raw.retentionDays === "number" && raw.retentionDays >= 0
        ? raw.retentionDays
        : null;
  out.push({
    name,
    url,
    feedUrl,
    description:
      typeof raw.description === "string"
        ? raw.description.trim() || null
        : typeof raw.blurb === "string"
          ? raw.blurb.trim() || null
          : null,
    enabled: raw.enabled !== false,
    retentionDays,
  });
}

function fromContributionFile(file: SourceLibraryFile, out: CreateSourceInput[], seen: Set<string>, warnings: string[]) {
  for (const feed of file.feeds ?? []) {
    pushLayer(out, seen, warnings, feed, `feed ${feed.id ?? feed.name}`);
  }
  for (const layer of file.customLayers ?? []) {
    pushLayer(out, seen, warnings, layer, `layer ${layer.key ?? layer.name}`);
  }
}

function fromDrafts(drafts: LocalSourceDraft[], out: CreateSourceInput[], seen: Set<string>, warnings: string[]) {
  for (const draft of drafts) {
    if (!draft.feedUrl?.trim()) {
      warnings.push(`Skipped draft “${draft.name}”: no feed URL.`);
      continue;
    }
    pushLayer(out, seen, warnings, draft, `draft ${draft.name}`);
  }
}

/** Parse JSON from Export, local Save, or a simple layer list. Safe to run in the browser. */
export function parseSourceImportJson(text: string): ParsedSourceImport {
  const warnings: string[] = [];
  const layers: CreateSourceInput[] = [];
  const seen = new Set<string>();

  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    throw new Error("File is not valid JSON.");
  }

  if (Array.isArray(data)) {
    for (const row of data) {
      if (row && typeof row === "object") {
        pushLayer(layers, seen, warnings, row as Record<string, unknown>, "list entry");
      }
    }
    return { layers, warnings };
  }

  if (!data || typeof data !== "object") {
    throw new Error("Expected a JSON object or array of layers.");
  }

  const obj = data as Record<string, unknown>;

  if (obj.schema === SOURCE_LIBRARY_SCHEMA) {
    fromContributionFile(obj as SourceLibraryFile, layers, seen, warnings);
  }

  if (Array.isArray(obj.drafts)) {
    fromDrafts(obj.drafts as LocalSourceDraft[], layers, seen, warnings);
  }

  const list = obj.layers ?? obj.sources ?? obj.import;
  if (Array.isArray(list)) {
    for (const row of list) {
      if (row && typeof row === "object") {
        pushLayer(layers, seen, warnings, row as Record<string, unknown>, "layer");
      }
    }
  }

  if (!layers.length && !warnings.length) {
    throw new Error(
      "No importable layers found. Use Export JSON from another csmon, or an array of { name, url, feedUrl }.",
    );
  }

  return { layers, warnings };
}
