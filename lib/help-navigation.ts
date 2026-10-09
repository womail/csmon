import { MANUAL_SECTIONS, type ManualSection } from "./manual-content";

export type HelpNavGroup = {
  id: string;
  label: string;
  /** Shown in sidebar when this filter is active. */
  audience: "user" | "maintainer";
  slugs: string[];
};

/** User-facing tour order with screenshots (see public/help/screenshots/). */
export const HELP_USER_NAV: HelpNavGroup[] = [
  {
    id: "start",
    label: "Start here",
    audience: "user",
    slugs: ["start", "desks-filters"],
  },
  {
    id: "workflow",
    label: "Daily workflow",
    audience: "user",
    slugs: ["read-in-place", "pulse-desk", "reports", "patch-desk"],
  },
  {
    id: "sources",
    label: "Sources & setup",
    audience: "user",
    slugs: ["sources", "options-limits"],
  },
  {
    id: "reference",
    label: "Reference",
    audience: "user",
    slugs: ["lexicon"],
  },
];

export const HELP_MAINTAINER_NAV: HelpNavGroup[] = [
  {
    id: "maintainer",
    label: "Maintainers",
    audience: "maintainer",
    slugs: [
      "maintainer-overview",
      "maintainer-code",
      "maintainer-sources",
      "maintainer-updates",
      "maintainer-wizards",
    ],
  },
];

export function sectionsForNav(groups: HelpNavGroup[]): ManualSection[] {
  const slugs = groups.flatMap((group) => group.slugs);
  const bySlug = new Map(MANUAL_SECTIONS.map((row) => [row.slug, row]));
  return slugs.map((slug) => bySlug.get(slug)).filter((row): row is ManualSection => row != null);
}

export function adjacentSlugs(slug: string, groups: HelpNavGroup[]) {
  const order = groups.flatMap((g) => g.slugs);
  const index = order.indexOf(slug);
  if (index < 0) return { prev: null as string | null, next: null as string | null };
  return {
    prev: index > 0 ? order[index - 1]! : null,
    next: index < order.length - 1 ? order[index + 1]! : null,
  };
}

export function filterGroups(audience: "user" | "maintainer" | "all") {
  if (audience === "user") return HELP_USER_NAV;
  if (audience === "maintainer") return HELP_MAINTAINER_NAV;
  return [...HELP_USER_NAV, ...HELP_MAINTAINER_NAV];
}
