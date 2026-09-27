"use client";

import { X } from "lucide-react";
import { Tip } from "@/components/monitor/tip";

/** Applied filter pill with an explicit remove control. */
export function DismissFilterChip({
  label,
  onDismiss,
  tip,
  background = "#0f172a",
  color = "#fff",
}: {
  label: string;
  onDismiss: () => void;
  tip?: string;
  background?: string;
  color?: string;
}) {
  const chip = (
    <button
      type="button"
      onClick={onDismiss}
      className="tag inline-flex max-w-[14rem] items-center gap-1 truncate"
      style={{ background, color }}
      aria-label={`Remove filter: ${label}`}
    >
      <span className="truncate">{label}</span>
      <X className="size-3 shrink-0 opacity-90" aria-hidden />
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
  activeBackground,
  activeColor,
  idleBackground,
  idleColor,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
  onDismiss?: () => void;
  tip?: string;
  activeBackground: string;
  activeColor: string;
  idleBackground: string;
  idleColor: string;
}) {
  const chip = (
    <button
      type="button"
      onClick={active && onDismiss ? onDismiss : onToggle}
      className="tag inline-flex max-w-[14rem] items-center gap-1 truncate"
      style={{
        background: active ? activeBackground : idleBackground,
        color: active ? activeColor : idleColor,
      }}
      aria-label={active ? `Remove filter: ${label}` : `Filter to ${label}`}
    >
      <span className="truncate">{label}</span>
      {active ? <X className="size-3 shrink-0 opacity-90" aria-hidden /> : null}
    </button>
  );
  return tip ? <Tip text={tip}>{chip}</Tip> : chip;
}
