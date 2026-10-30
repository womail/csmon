import type { BoardFilters } from "@/lib/board-state";
import { facetsFromFilters } from "@/lib/facets";
import type { Desk, Source } from "@/lib/types";

export function activeFilterCount(
  filters: BoardFilters,
  extras: {
    filterTopics: string[];
    filterTags: string[];
    displayOnly: boolean;
    viewDesk: string;
  },
): number {
  const facets = facetsFromFilters({ ...filters, topics: extras.filterTopics, tags: extras.filterTags });
  return facets.length + (extras.displayOnly ? 1 : 0);
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
    feeds: "Feeds",
    sources: "Sources",
  };
  return labels[desk] ?? desk;
}

export function filterSummaryLine(filters: BoardFilters, sources?: Map<number, Source>): string {
  const labels = facetsFromFilters(filters, { sources }).map((facet) =>
    facet.kind === "text" ? `“${facet.value.slice(0, 24)}${facet.value.length > 24 ? "…" : ""}”` : facet.label,
  );
  return labels.length ? labels.join(" · ") : "No filters";
}
