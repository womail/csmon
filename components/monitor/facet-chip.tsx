"use client";

import {
  Building2,
  Bug,
  CircleDot,
  Factory,
  Filter,
  FolderTree,
  MapPin,
  Radio,
  Search,
  Shield,
  Sparkles,
  Tag,
  TrendingUp,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { Tip } from "@/components/monitor/tip";
import { KIND_LABEL, type Facet, type FacetKind } from "@/lib/facets";
import type { AppliedFilterVariant } from "@/components/monitor/filter-chip";

export const FACET_ICON: Record<FacetKind, LucideIcon> = {
  text: Search,
  topic: Tag,
  family: Sparkles,
  tag: Tag,
  nest: Tag,
  place: MapPin,
  person: User,
  org: Building2,
  vendor: Factory,
  cve: Bug,
  source: Radio,
  stype: Shield,
  category: FolderTree,
  origin: CircleDot,
  platform: CircleDot,
  rising: TrendingUp,
  cross: Shield,
  ransomware: Bug,
  risk: Bug,
  rule: Filter,
};

const VARIANT: Partial<Record<FacetKind, AppliedFilterVariant>> = {
  text: "search",
  topic: "topic",
  family: "topic",
  tag: "topic",
  nest: "topic",
  place: "place",
  person: "person",
  org: "person",
  vendor: "vendor",
  cve: "vendor",
  source: "layer",
  stype: "layer",
  category: "layer",
  risk: "risk",
  rule: "query",
};

/** One removable constraint in the Active row. Hover shows the typed form. */
export function FacetChip({ facet, onRemove }: { facet: Facet; onRemove: () => void }) {
  const Icon = FACET_ICON[facet.kind];
  const variant = VARIANT[facet.kind] ?? "default";
  const label = facet.kind === "text" ? `“${facet.label.slice(0, 32)}${facet.label.length > 32 ? "…" : ""}”` : facet.label;
  const tip = `${KIND_LABEL[facet.kind]}${facet.negate ? " (excluded)" : ""} · ${facet.token}\nClick to remove.`;
  return (
    <Tip text={tip}>
      <button
        type="button"
        onClick={onRemove}
        className={`filter-chip filter-chip-applied filter-chip-applied-${variant} ${facet.negate ? "facet-chip-negated" : ""}`}
        aria-label={`Remove filter: ${facet.label}`}
      >
        <Icon className="size-2.5 shrink-0 opacity-70" aria-hidden />
        <span className="filter-chip-label">{label}</span>
        <X className="filter-chip-x" aria-hidden />
      </button>
    </Tip>
  );
}
