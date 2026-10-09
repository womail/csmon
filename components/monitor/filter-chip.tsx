"use client";

import { X } from "lucide-react";
import { Tip } from "@/components/monitor/tip";

export type AppliedFilterVariant =
  | "default"
  | "search"
  | "topic"
  | "place"
  | "person"
  | "vendor"
  | "watch"
  | "query"
  | "risk"
  | "layer";

/** Active constraint — always dismissible, accent stripe only (not a full color fill). */
export function DismissFilterChip({
  label,
  onDismiss,
  tip,
  variant = "default",
}: {
  label: string;
  onDismiss: () => void;
  tip?: string;
  variant?: AppliedFilterVariant;
}) {
  const chip = (
    <button
      type="button"
      onClick={onDismiss}
      className={`filter-chip filter-chip-applied filter-chip-applied-${variant}`}
      aria-label={`Remove filter: ${label}`}
    >
      <span className="filter-chip-label">{label}</span>
      <X className="filter-chip-x" aria-hidden />
    </button>
  );
  return tip ? <Tip text={tip}>{chip}</Tip> : chip;
}

export type ToggleAccent = "neutral" | "place" | "rise" | "danger" | "more";

/** Board filter you can turn on/off (2+ sources, rising, pinned places). */
export function BoardFilterToggle({
  label,
  active,
  onClick,
  tip,
  accent = "neutral",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tip?: string;
  accent?: ToggleAccent;
}) {
  const chip = (
    <button
      type="button"
      onClick={onClick}
      className={`filter-chip filter-chip-toggle filter-chip-toggle-${accent}`}
      data-active={active ? "true" : "false"}
      aria-pressed={active}
    >
      <span className="filter-chip-label">{label}</span>
      {active ? <X className="filter-chip-x" aria-hidden /> : null}
    </button>
  );
  return tip ? <Tip text={tip}>{chip}</Tip> : chip;
}

/** Topic / place / vendor chip: shows × when filtered on. */
export function ToggleFilterChip({
  label,
  active,
  onToggle,
  onDismiss,
  tip,
  accent = "place",
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
  onDismiss?: () => void;
  tip?: string;
  accent?: ToggleAccent;
}) {
  const chip = (
    <button
      type="button"
      onClick={active && onDismiss ? onDismiss : onToggle}
      className={`filter-chip filter-chip-toggle filter-chip-toggle-${accent}`}
      data-active={active ? "true" : "false"}
      aria-pressed={active}
      aria-label={active ? `Remove filter: ${label}` : `Filter to ${label}`}
    >
      <span className="filter-chip-label">{label}</span>
      {active ? <X className="filter-chip-x" aria-hidden /> : null}
    </button>
  );
  return tip ? <Tip text={tip}>{chip}</Tip> : chip;
}
