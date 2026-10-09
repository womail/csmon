import type { BoardFilters } from "@/lib/board-state";
import { hasQuery } from "@/lib/query-builder";
import type { Desk } from "@/lib/types";

export function activeFilterCount(
  filters: BoardFilters,
  extras: {
    filterTopics: string[];
    filterTags: string[];
    displayOnly: boolean;
    viewDesk: string;
  },
): number {
  let n = 0;
  if (filters.q.trim()) n++;
  if (filters.topic) n++;
  n += extras.filterTopics.length;
  n += extras.filterTags.length;
  if (filters.place) n++;
  if (filters.person) n++;
  if (filters.vendor) n++;
  if (filters.layer) n++;
  if (filters.platform) n++;
  if (filters.origin) n++;
  if (filters.cross) n++;
  if (filters.rising) n++;
  if (filters.ransomware) n++;
  if (hasQuery(filters.qb)) n++;
  if (extras.displayOnly) n++;
  if (extras.viewDesk === "patch" && filters.risk !== "all") n++;
  return n;
}

export function deskLabel(desk: Desk, customName?: string) {
  if (customName) return customName;
  const labels: Record<string, string> = {
    home: "Home",
    brief: "Brief",
    scan: "Scan",
    pulse: "Pulse",
    weather: "Weather",
    people: "People",
    documents: "Documents",
    reports: "Reports",
    flights: "Flights",
    advisories: "Advisories",
    patch: "Patch",
    sources: "Sources",
  };
  return labels[desk] ?? desk;
}

export function filterSummaryLine(filters: BoardFilters): string {
  const parts: string[] = [];
  if (filters.place) parts.push(filters.place);
  if (filters.topic) parts.push(filters.topic);
  if (filters.person) parts.push(filters.person);
  if (filters.vendor) parts.push(filters.vendor);
  if (filters.platform) parts.push(filters.platform);
  if (filters.q.trim()) parts.push(`“${filters.q.trim().slice(0, 24)}${filters.q.trim().length > 24 ? "…" : ""}”`);
  return parts.length ? parts.join(" · ") : "No filters";
}
