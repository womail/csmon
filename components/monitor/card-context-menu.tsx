"use client";

import { useState } from "react";
import { listClassifyTopics } from "@/lib/classify";
import { groupByFamily } from "@/lib/topic-families";
import { ContextMenu, type ContextMenuSection } from "@/components/monitor/context-menu";

export type CardMenuAction =
  | { kind: "open" }
  | { kind: "open-original" }
  | { kind: "report" }
  | { kind: "hide" }
  | { kind: "read" }
  | { kind: "watch" }
  | { kind: "find-coverage" }
  | { kind: "only-source" }
  | { kind: "mute-source" }
  | { kind: "filter-topic"; topic: string }
  | { kind: "filter-place"; place: string }
  | { kind: "copy-link" }
  | { kind: "copy-citation" }
  | { kind: "copy-title" }
  | { kind: "reclassify"; topics: string[] }
  | { kind: "reset-topics" }
  | { kind: "display-only" }
  | { kind: "add-display" }
  | { kind: "save-desk" }
  | { kind: "close" };

export function CardContextMenu({
  x,
  y,
  title,
  currentTopics,
  topicsLocked = false,
  sourceName,
  topic,
  place,
  read,
  reportTitle,
  onAction,
  onClose,
}: {
  x: number;
  y: number;
  title: string;
  currentTopics: string[];
  /** The user set these topics; the classifier leaves them alone. */
  topicsLocked?: boolean;
  sourceName: string | null;
  topic: string | null;
  place: string | null;
  read: boolean;
  /** Open briefing that "Add to report" will append to; null starts a new one. */
  reportTitle: string | null;
  onAction: (action: CardMenuAction) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(() => new Set(currentTopics));
  const [showTopics, setShowTopics] = useState(false);
  const groups = groupByFamily(listClassifyTopics());

  const sections: ContextMenuSection[] = [
    {
      items: [
        { id: "open", label: "Read in place", hint: "Enter", onSelect: () => onAction({ kind: "open" }) },
        { id: "open-original", label: "Open original", hint: "new tab", onSelect: () => onAction({ kind: "open-original" }) },
        {
          id: "report",
          label: reportTitle ? `Add to report · ${reportTitle}` : "Start a report",
          hint: "r",
          onSelect: () => onAction({ kind: "report" }),
        },
        { id: "watch", label: "Watch this story…", onSelect: () => onAction({ kind: "watch" }) },
        { id: "find", label: "Find other coverage", onSelect: () => onAction({ kind: "find-coverage" }) },
      ],
    },
    {
      label: "Filter",
      items: [
        ...(sourceName
          ? [{ id: "only-source", label: `Only ${sourceName}`, onSelect: () => onAction({ kind: "only-source" }) }]
          : []),
        ...(topic ? [{ id: "topic", label: `Topic: ${topic}`, onSelect: () => onAction({ kind: "filter-topic", topic }) }] : []),
        ...(place ? [{ id: "place", label: `Place: ${place}`, onSelect: () => onAction({ kind: "filter-place", place }) }] : []),
      ],
    },
    {
      label: "Triage",
      items: [
        { id: "read", label: read ? "Already read" : "Mark read", disabled: read, onSelect: () => onAction({ kind: "read" }) },
        { id: "hide", label: "Hide from board", hint: "h", onSelect: () => onAction({ kind: "hide" }) },
        ...(sourceName
          ? [{ id: "mute", label: `Mute layer ${sourceName}`, danger: true, onSelect: () => onAction({ kind: "mute-source" }) }]
          : []),
      ],
    },
    {
      label: "Copy",
      items: [
        { id: "copy-link", label: "Link to card", onSelect: () => onAction({ kind: "copy-link" }) },
        { id: "copy-citation", label: "Citation (Markdown)", onSelect: () => onAction({ kind: "copy-citation" }) },
        { id: "copy-title", label: "Title and URL", onSelect: () => onAction({ kind: "copy-title" }) },
      ],
    },
    {
      label: "Organise",
      items: [
        { id: "display-only", label: "Display only this card", onSelect: () => onAction({ kind: "display-only" }) },
        { id: "add-display", label: "Add to display collection", onSelect: () => onAction({ kind: "add-display" }) },
        { id: "save-desk", label: "Save to My desk…", onSelect: () => onAction({ kind: "save-desk" }) },
        {
          id: "reclassify",
          label: showTopics ? "Hide reclassify" : "Reclassify topics…",
          onSelect: () => setShowTopics((v) => !v),
        },
        ...(topicsLocked
          ? [{ id: "reset-topics", label: "Reset to automatic", onSelect: () => onAction({ kind: "reset-topics" }) }]
          : []),
      ],
    },
  ];

  const footer = showTopics ? (
    <div className="flex min-h-0 flex-col border-t border-border">
      <p className="shrink-0 px-2.5 py-1 text-[10px] text-muted-foreground">
        {topicsLocked ? "You set these topics. " : ""}Shift+click a chip to drop one tag.
      </p>
      <div className="min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: "min(40vh, 240px)" }}>
        {groups.map(({ family, topics }) => (
          <div key={family.id} role="group" aria-label={family.label}>
            <p className="flex items-center gap-1.5 px-2.5 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="fam-dot" style={{ background: `var(${family.tone})` }} aria-hidden />
              {family.label}
            </p>
        {topics.map((name) => (
          <button
            key={name}
            type="button"
            role="menuitemcheckbox"
            aria-checked={selected.has(name)}
            className="flex w-full items-center gap-2 px-2.5 py-1 text-left text-[12px] hover:bg-muted"
            onClick={() => {
              setSelected((prev) => {
                const next = new Set(prev);
                if (next.has(name)) next.delete(name);
                else next.add(name);
                return next;
              });
            }}
          >
            <span className="inline-block size-3 shrink-0 rounded border border-border bg-background text-[9px] leading-3">
              {selected.has(name) ? "✓" : ""}
            </span>
            {name}
          </button>
        ))}
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t border-border bg-popover px-2 py-1.5">
        <button
          type="button"
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] font-medium hover:bg-muted disabled:opacity-40"
          disabled={selected.size === 0}
          onClick={() => onAction({ kind: "reclassify", topics: [...selected] })}
        >
          Apply topics
        </button>
      </div>
    </div>
  ) : null;

  return (
    <ContextMenu
      x={x}
      y={y}
      title={title.length > 60 ? `${title.slice(0, 57)}…` : title}
      sections={sections}
      footer={footer}
      onClose={onClose}
    />
  );
}
