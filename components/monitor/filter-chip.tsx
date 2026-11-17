"use client";

import { Eye, EyeOff, X } from "lucide-react";
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

/** Hide / show this value without isolating the board to it. */
export function VisibilityToggle({
  hidden,
  label,
  onToggle,
}: {
  hidden: boolean;
  label: string;
  onToggle: () => void;
}) {
  const Icon = hidden ? EyeOff : Eye;
  const word = hidden ? "Show" : "Hide";
  return (
    <button
      type="button"
      className="filter-vis-btn"
      data-hidden={hidden ? "true" : "false"}
      aria-pressed={hidden}
      aria-label={`${word} ${label}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
    >
      <Icon className="filter-vis-icon" aria-hidden />
      <span className="filter-vis-word">{word}</span>
    </button>
  );
}

/** Topic / place / vendor chip: shows × when filtered on, eye to hide / show. */
export function ToggleFilterChip({
  label,
  count,
  kindLabel,
  active,
  excluded,
  onToggle,
  onDismiss,
  onExclude,
  tip,
  accent = "place",
}: {
  label: string;
  /** Secondary figure, omitted from the accessible name. */
  count?: number;
  /** Kind prefix, as in "Place · Ireland". */
  kindLabel?: string;
  active: boolean;
  excluded?: boolean;
  onToggle: () => void;
  onDismiss?: () => void;
  onExclude?: () => void;
  tip?: string;
  accent?: ToggleAccent;
}) {
  const hidden = Boolean(excluded);
  const name = kindLabel ? `${kindLabel} · ${label}` : label;
  const chip = (
    <span
      className={`filter-chip filter-chip-toggle filter-chip-toggle-${accent} ${hidden ? "filter-chip-excluded" : ""}`}
      data-active={active ? "true" : "false"}
      data-hidden={hidden ? "true" : "false"}
    >
      <button
        type="button"
        onClick={hidden && onExclude ? onExclude : active && onDismiss ? onDismiss : onToggle}
        className="filter-chip-main"
        aria-pressed={active}
        aria-label={
          hidden ? `Show ${name}` : active ? `Remove filter: ${name}` : name
        }
      >
        <span className="filter-chip-label">{name}</span>
        {count != null ? (
          <span className="filter-chip-count" aria-hidden>
            {count}
          </span>
        ) : null}
        {active ? <X className="filter-chip-x" aria-hidden /> : null}
      </button>
      {onExclude ? <VisibilityToggle hidden={hidden} label={label} onToggle={onExclude} /> : null}
    </span>
  );
  return tip ? <Tip text={tip}>{chip}</Tip> : chip;
}
