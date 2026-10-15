import { defaultBoardFilters, normalizeBoardFilters, type BoardFilters } from "./board-state";
import {
  createUserDesk,
  loadUserDesks,
  type UserDesk,
} from "./user-desks";

export const POLITICS_DESK_LABEL = "Politics";

export function politicsDeskFilters(): BoardFilters {
  return normalizeBoardFilters({
    ...defaultBoardFilters(),
    desk: "home",
    topic: "politics",
    origin: "intel",
    range: "24h",
  });
}

/** Pin a Brief desk filtered to politics intel (idempotent by label). */
export function ensurePoliticsUserDesk(existing?: UserDesk[]): UserDesk[] {
  const rows = existing ?? loadUserDesks();
  if (rows.some((row) => row.label.toLowerCase() === POLITICS_DESK_LABEL.toLowerCase())) {
    return rows;
  }
  return createUserDesk(POLITICS_DESK_LABEL, politicsDeskFilters(), rows, "brief");
}

export function findPoliticsUserDesk(existing?: UserDesk[]): UserDesk | null {
  const rows = existing ?? loadUserDesks();
  return (
    rows.find((row) => row.label.toLowerCase() === POLITICS_DESK_LABEL.toLowerCase()) ?? null
  );
}
