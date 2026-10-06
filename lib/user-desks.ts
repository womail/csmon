import type { BoardFilters } from "./board-state";
import { defaultBoardFilters, normalizeBoardFilters } from "./board-state";
import { activeQueryRules } from "./query-builder";
import { isBuiltinDesk, isDeskId, type BuiltinDesk } from "./types";

const LABEL_MAX = 32;
const HINT_MAX = 40;

export type UserDesk = {
  id: `c-${string}`;
  label: string;
  hint: string;
  view: BuiltinDesk;
  filters: BoardFilters;
  createdAt: number;
};

export const USER_DESKS_KEY = "csmon.user-desks";

function asCustomId(value: string): `c-${string}` | null {
  return value.startsWith("c-") ? (value as `c-${string}`) : null;
}

function looksLikeQueryDump(label: string) {
  return /\b(contains|equals|not equal|\band\b|\bor\b)\b/i.test(label);
}

export function autoDeskLabel(filters: BoardFilters): string {
  const first = activeQueryRules(filters.qb)[0]?.value.trim() ?? "";
  const bits = [
    filters.place,
    filters.topic,
    ...filters.topics,
    ...filters.tags.slice(0, 2),
    filters.vendor,
    filters.person,
    filters.q.trim(),
    first,
  ].filter(Boolean);
  return String(bits[0] ?? "Custom desk").slice(0, LABEL_MAX);
}

export function resolveDeskLabel(raw: string | undefined, filters: BoardFilters): string {
  const name = (raw ?? "").trim();
  if (name && !looksLikeQueryDump(name)) return name.slice(0, LABEL_MAX);
  return autoDeskLabel(filters);
}

export function summarizeDesk(filters: BoardFilters) {
  const rules = activeQueryRules(filters.qb);
  const queryBit = rules.length
    ? rules.length === 1
      ? rules[0].value.trim()
      : `${rules[0].value.trim()} +${rules.length - 1}`
    : "";
  const bits = [
    filters.platform,
    filters.topic,
    ...filters.topics,
    ...filters.tags,
    filters.place,
    filters.origin,
    filters.vendor,
    filters.person,
    filters.rising ? "rising" : "",
    queryBit,
    filters.q.trim(),
  ].filter(Boolean);
  const unique = bits.filter((bit, index, all) => all.indexOf(bit) === index);
  return unique.slice(0, 3).join(" · ").slice(0, HINT_MAX) || "Custom filter desk";
}

export function loadUserDesks(): UserDesk[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(USER_DESKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<UserDesk>[];
    const fallback = defaultBoardFilters();
    const rows: UserDesk[] = [];
    let dirty = false;
    for (const row of parsed) {
      const id = typeof row.id === "string" ? asCustomId(row.id) : null;
      if (!id || typeof row.label !== "string") continue;
      const view = typeof row.view === "string" && isBuiltinDesk(row.view) ? row.view : "brief";
      const filters = normalizeBoardFilters({
        ...fallback,
        ...row.filters,
        desk: id,
      });
      const label = resolveDeskLabel(row.label, filters);
      const hint = summarizeDesk(filters);
      if (label !== row.label || hint !== row.hint) dirty = true;
      rows.push({
        id,
        label,
        hint,
        view,
        createdAt: typeof row.createdAt === "number" ? row.createdAt : Date.now(),
        filters,
      });
    }
    const list = rows.slice(0, 12);
    if (dirty) saveUserDesks(list);
    return list;
  } catch {
    return [];
  }
}

export function saveUserDesks(rows: UserDesk[]) {
  window.localStorage.setItem(USER_DESKS_KEY, JSON.stringify(rows.slice(0, 12)));
}

export function createUserDesk(
  label: string,
  filters: BoardFilters,
  existing?: UserDesk[],
  view: BuiltinDesk = "brief",
) {
  const saved = normalizeBoardFilters({ ...filters, desk: "home" });
  const name = resolveDeskLabel(label, saved);
  if (!name) return existing ?? loadUserDesks();
  const id = `c-${Date.now().toString(36)}` as const;
  saved.desk = id;
  const next: UserDesk = {
    id,
    label: name,
    hint: summarizeDesk(saved),
    view,
    createdAt: Date.now(),
    filters: saved,
  };
  const rows = [
    next,
    ...(existing ?? loadUserDesks()).filter((row) => row.label.toLowerCase() !== name.toLowerCase()),
  ];
  saveUserDesks(rows);
  return rows;
}

export function updateUserDesk(
  id: string,
  patch: { label?: string; filters?: BoardFilters; view?: BuiltinDesk },
  existing?: UserDesk[],
) {
  const rows = (existing ?? loadUserDesks()).map((row) => {
    if (row.id !== id) return row;
    const filters = patch.filters
      ? normalizeBoardFilters({ ...patch.filters, desk: row.id })
      : row.filters;
    const label = resolveDeskLabel(patch.label ?? row.label, filters);
    return {
      ...row,
      label,
      view: patch.view ?? row.view,
      hint: summarizeDesk(filters),
      filters,
    };
  });
  saveUserDesks(rows);
  return rows;
}

export function deleteUserDesk(id: string, existing?: UserDesk[]) {
  const rows = (existing ?? loadUserDesks()).filter((row) => row.id !== id);
  saveUserDesks(rows);
  return rows;
}

export function findUserDesk(id: string, existing?: UserDesk[]) {
  return (existing ?? loadUserDesks()).find((row) => row.id === id) ?? null;
}

export function isKnownDesk(id: string, custom: UserDesk[]) {
  return isDeskId(id) && (!id.startsWith("c-") || custom.some((row) => row.id === id));
}
