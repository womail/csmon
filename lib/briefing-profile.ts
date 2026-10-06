import type { BoardFilters } from "./board-state";
import type { Desk, TimeRange } from "./types";

export const BRIEFING_PROFILE_KEY = "csmon.my-briefing";

export type MyBriefingProfile = {
  name: string;
  desk: Desk;
  q: string;
  topic: string | null;
  place: string | null;
  range: TimeRange;
  rising: boolean;
  cross: boolean;
  layer: number | null;
  /** Enabled source keys at save time (optional layer focus). */
  enabledSourceKeys: string[];
  updatedAt: number;
};

export function loadMyBriefing(): MyBriefingProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BRIEFING_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MyBriefingProfile;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveMyBriefing(profile: MyBriefingProfile) {
  window.localStorage.setItem(BRIEFING_PROFILE_KEY, JSON.stringify(profile));
}

export function captureBriefingFromBoard(
  filters: BoardFilters,
  enabledSourceKeys: string[],
  name = "My briefing",
): MyBriefingProfile {
  return {
    name,
    desk: filters.desk,
    q: filters.q,
    topic: filters.topic,
    place: filters.place,
    range: filters.range,
    rising: filters.rising,
    cross: filters.cross,
    layer: filters.layer,
    enabledSourceKeys: [...new Set(enabledSourceKeys)],
    updatedAt: Date.now(),
  };
}
