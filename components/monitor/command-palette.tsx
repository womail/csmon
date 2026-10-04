"use client";

import { useEffect, useMemo, useState } from "react";
import { DESKS } from "@/lib/board-state";
import { COMMAND_DESKS } from "@/lib/hotkeys";
import type { Watchlist } from "@/lib/types";
import type { UserDesk } from "@/lib/user-desks";
import type { Desk, Source } from "@/lib/types";

export type PaletteAction =
  | { kind: "desk"; desk: Desk }
  | { kind: "place"; place: string }
  | { kind: "source"; sourceId: number }
  | { kind: "watch"; watch: Watchlist }
  | { kind: "search" }
  | { kind: "refresh" }
  | { kind: "help" }
  | { kind: "watch-current" };

type Row = {
  id: string;
  label: string;
  hint: string;
  action: PaletteAction;
};

const CHEATSHEET = [
  { keys: "/", action: "Focus search" },
  { keys: "Ctrl/⌘ K", action: "Command palette" },
  { keys: "j / k", action: "Next / previous card" },
  { keys: "Enter", action: "Open focused card" },
  { keys: "h", action: "Hide focused card" },
  { keys: "u", action: "Undo last hide/read" },
  { keys: "r", action: "Send focused story to the open report" },
  { keys: "1–9", action: "Jump desks (Home through Flights)" },
  { keys: "?", action: "This cheatsheet" },
  { keys: "Esc", action: "Close pane / palette" },
];

export function CommandPalette({
  open,
  mode,
  sources,
  places,
  watches,
  customDesks,
  onClose,
  onAction,
}: {
  open: boolean;
  mode: "palette" | "help";
  sources: Source[];
  places: string[];
  watches: Watchlist[];
  customDesks: UserDesk[];
  onClose: () => void;
  onAction: (action: PaletteAction) => void;
}) {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (open) setQ("");
  }, [open]);

  const rows = useMemo(() => {
    const list: Row[] = [
      { id: "search", label: "Focus search", hint: "/", action: { kind: "search" } },
      { id: "refresh", label: "Refresh layers", hint: "reload", action: { kind: "refresh" } },
      { id: "watch-current", label: "Watch this query", hint: "watchlist", action: { kind: "watch-current" } },
      { id: "help", label: "Keyboard cheatsheet", hint: "?", action: { kind: "help" } },
    ];
    for (const desk of DESKS) {
      const idx = COMMAND_DESKS.indexOf(desk.id as (typeof COMMAND_DESKS)[number]);
      list.push({
        id: `desk-${desk.id}`,
        label: `Desk: ${desk.label}`,
        hint: idx >= 0 ? String(idx + 1) : desk.id,
        action: { kind: "desk", desk: desk.id },
      });
    }
    for (const desk of customDesks) {
      list.push({
        id: `cdesk-${desk.id}`,
        label: `Desk: ${desk.label}`,
        hint: "custom",
        action: { kind: "desk", desk: desk.id },
      });
    }
    for (const place of places.slice(0, 12)) {
      list.push({
        id: `place-${place}`,
        label: `Place: ${place}`,
        hint: "filter",
        action: { kind: "place", place },
      });
    }
    for (const source of sources.filter((row) => row.enabled).slice(0, 16)) {
      list.push({
        id: `src-${source.id}`,
        label: `Source: ${source.name}`,
        hint: source.handle ?? "layer",
        action: { kind: "source", sourceId: source.id },
      });
    }
    for (const watch of watches) {
      list.push({
        id: `watch-${watch.id}`,
        label: `Watch: ${watch.name}`,
        hint: watch.newHits ? `${watch.newHits} new` : watch.query,
        action: { kind: "watch", watch },
      });
    }
    const needle = q.trim().toLowerCase();
    if (!needle) return list.slice(0, 18);
    return list
      .filter((row) => `${row.label} ${row.hint}`.toLowerCase().includes(needle))
      .slice(0, 18);
  }, [customDesks, places, q, sources, watches]);

  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [q, open, mode]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-3 pt-[12vh]" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
        onClick={(event) => event.stopPropagation()}
      >
        {mode === "help" ? (
          <div className="p-3">
            <div className="text-[12px] font-semibold text-slate-800">Keyboard</div>
            <p className="mt-1 text-[11px] text-slate-500">
              Search understands <code className="text-[11px]">source:cisa cve:2024- ioc:sha256</code>
            </p>
            <ul className="mt-3 space-y-1.5">
              {CHEATSHEET.map((row) => (
                <li key={row.keys} className="flex items-baseline justify-between gap-3 text-[12px]">
                  <span className="font-mono text-[11px] text-slate-600">{row.keys}</span>
                  <span className="text-slate-700">{row.action}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <input
              autoFocus
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Jump to desk, place, source, watch…"
              className="h-10 w-full border-b border-slate-200 px-3 text-[13px] outline-none"
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setIndex((current) => Math.min(rows.length - 1, current + 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setIndex((current) => Math.max(0, current - 1));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  const row = rows[index];
                  if (row) onAction(row.action);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  onClose();
                }
              }}
            />
            <ul className="max-h-80 overflow-auto py-1">
              {rows.map((row, i) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[12px] ${
                      i === index ? "bg-slate-100 text-slate-900" : "text-slate-700"
                    }`}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => onAction(row.action)}
                  >
                    <span className="min-w-0 truncate">{row.label}</span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-400">{row.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
