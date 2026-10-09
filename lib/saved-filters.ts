import {
  defaultBoardFilters,
  type BoardFilters,
} from "./board-state";
import { encodeQueryTree, parseQueryTree, type QueryTree } from "./query-builder";
import type { OriginReason, TimeRange } from "./types";
import type { PatchRisk } from "./kev";

export type SavedFilter = {
  id: string;
  name: string;
  filters: BoardFilters;
  createdAt: number;
  /** Up to three hypotheses for ACH-style reading (optional). */
  hypotheses?: string[];
};

export const SAVED_FILTERS_KEY = "csmon.saved-filters";

function asDesk(value: unknown, fallback: BoardFilters["desk"]): BoardFilters["desk"] {
  return typeof value === "string" && (value.startsWith("c-") || [
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
  ].includes(value))
    ? (value as BoardFilters["desk"])
    : fallback;
}

function hydrate(raw: Partial<SavedFilter>, fallback: BoardFilters): SavedFilter | null {
  if (!raw || typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  const filters = raw.filters ?? fallback;
  const hypotheses = Array.isArray(raw.hypotheses)
    ? raw.hypotheses
        .filter((line): line is string => typeof line === "string" && line.trim().length > 0)
        .slice(0, 3)
    : undefined;
  return {
    id: raw.id,
    name: raw.name,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    hypotheses: hypotheses?.length ? hypotheses : undefined,
    filters: {
      desk: asDesk(filters.desk, fallback.desk),
      q: typeof filters.q === "string" ? filters.q : "",
      topic: filters.topic ?? null,
      topics: Array.isArray(filters.topics) ? filters.topics : fallback.topics,
      place: filters.place ?? null,
      tags: Array.isArray(filters.tags) ? filters.tags : fallback.tags,
      range: (filters.range as TimeRange) || fallback.range,
      cross: Boolean(filters.cross),
      stack: typeof filters.stack === "string" ? filters.stack : "",
      risk: (filters.risk as PatchRisk | "all") || fallback.risk,
      vendor: filters.vendor ?? null,
      ransomware: Boolean(filters.ransomware),
      layer: typeof filters.layer === "number" ? filters.layer : null,
      origin: (filters.origin as OriginReason | null) ?? null,
      platform:
        filters.platform === "rss" || filters.platform === "bluesky" || filters.platform === "web"
          ? filters.platform
          : null,
      person: filters.person ?? null,
      rising: Boolean(filters.rising),
      focusItem: null,
      qb: parseQueryTree(
        typeof filters.qb === "string"
          ? filters.qb
          : encodeQueryTree(filters.qb as QueryTree | undefined),
      ),
    },
  };
}

export function loadSavedFilters(): SavedFilter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_FILTERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<SavedFilter>[];
    const fallback = defaultBoardFilters();
    return parsed
      .map((row) => hydrate(row, fallback))
      .filter((row): row is SavedFilter => row != null);
  } catch {
    return [];
  }
}

export function saveSavedFilters(rows: SavedFilter[]) {
  window.localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(rows.slice(0, 24)));
}

export function upsertSavedFilter(name: string, filters: BoardFilters, existing?: SavedFilter[]) {
  const rows = existing ?? loadSavedFilters();
  const trimmed = name.trim().slice(0, 48);
  if (!trimmed) return rows;
  const next: SavedFilter = {
    id: `filter-${Date.now().toString(36)}`,
    name: trimmed,
    filters,
    createdAt: Date.now(),
  };
  const replaced = rows.filter((row) => row.name.toLowerCase() !== trimmed.toLowerCase());
  const list = [next, ...replaced].slice(0, 24);
  saveSavedFilters(list);
  return list;
}

export function deleteSavedFilter(id: string, existing?: SavedFilter[]) {
  const rows = (existing ?? loadSavedFilters()).filter((row) => row.id !== id);
  saveSavedFilters(rows);
  return rows;
}

export function updateSavedFilterHypotheses(
  id: string,
  hypotheses: string[],
  existing?: SavedFilter[],
) {
  const rows = (existing ?? loadSavedFilters()).map((row) => {
    if (row.id !== id) return row;
    const trimmed = hypotheses.map((line) => line.trim()).filter(Boolean).slice(0, 3);
    return { ...row, hypotheses: trimmed.length ? trimmed : undefined };
  });
  saveSavedFilters(rows);
  return rows;
}
