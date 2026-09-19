import type { BoardFilters } from "./board-state";
import { defaultBoardFilters } from "./board-state";
import { isDeskId, type Desk } from "./types";

export type UserDesk = {
  id: `c-${string}`;
  label: string;
  hint: string;
  filters: BoardFilters;
  createdAt: number;
};

export const USER_DESKS_KEY = "csmon.user-desks";

function asCustomId(value: string): `c-${string}` | null {
  return value.startsWith("c-") ? (value as `c-${string}`) : null;
}

export function loadUserDesks(): UserDesk[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(USER_DESKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<UserDesk>[];
    const fallback = defaultBoardFilters();
    const rows: UserDesk[] = [];
    for (const row of parsed) {
      const id = typeof row.id === "string" ? asCustomId(row.id) : null;
      if (!id || typeof row.label !== "string") continue;
      rows.push({
        id,
        label: row.label.slice(0, 24),
        hint: typeof row.hint === "string" ? row.hint.slice(0, 48) : "Custom desk",
        createdAt: typeof row.createdAt === "number" ? row.createdAt : Date.now(),
        filters: {
          ...fallback,
          ...row.filters,
          desk: id,
        },
      });
    }
    return rows.slice(0, 12);
  } catch {
    return [];
  }
}

export function saveUserDesks(rows: UserDesk[]) {
  window.localStorage.setItem(USER_DESKS_KEY, JSON.stringify(rows.slice(0, 12)));
}

export function createUserDesk(label: string, filters: BoardFilters, existing?: UserDesk[]) {
  const name = label.trim().slice(0, 24);
  if (!name) return existing ?? loadUserDesks();
  const id = `c-${Date.now().toString(36)}` as const;
  const next: UserDesk = {
    id,
    label: name,
    hint: summarizeDesk(filters),
    createdAt: Date.now(),
    filters: { ...filters, desk: id },
  };
  const rows = [next, ...(existing ?? loadUserDesks()).filter((row) => row.label.toLowerCase() !== name.toLowerCase())];
  saveUserDesks(rows);
  return rows;
}

export function deleteUserDesk(id: string, existing?: UserDesk[]) {
  const rows = (existing ?? loadUserDesks()).filter((row) => row.id !== id);
  saveUserDesks(rows);
  return rows;
}

export function findUserDesk(id: Desk, existing?: UserDesk[]) {
  return (existing ?? loadUserDesks()).find((row) => row.id === id) ?? null;
}

export function summarizeDesk(filters: BoardFilters) {
  const bits = [filters.topic, filters.place, filters.vendor, filters.person, filters.q].filter(Boolean);
  return bits.slice(0, 3).join(" · ") || "Custom filter desk";
}

export function isKnownDesk(id: string, custom: UserDesk[]) {
  return isDeskId(id) && (!id.startsWith("c-") || custom.some((row) => row.id === id));
}
