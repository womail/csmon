"use client";

import { useEffect, useMemo, useState } from "react";
import type { BoardFilters } from "@/lib/board-state";
import { DESKS } from "@/lib/board-state";
import { COMMAND_DESKS } from "@/lib/hotkeys";
import type { MyBriefingProfile } from "@/lib/briefing-profile";
import type { SavedFilter } from "@/lib/saved-filters";
import type { Watchlist } from "@/lib/types";
import type { UserDesk } from "@/lib/user-desks";
import type { Desk } from "@/lib/types";
import { KIND_LABEL, type FacetInput } from "@/lib/facets";
import type { Connection } from "@/lib/connections";
import { trailLine, type TrailEntry } from "@/lib/filter-trail";
import {
  entryKey,
  entryToken,
  loadPaletteRecent,
  rankEntries,
  rememberPalettePick,
  splitPrefix,
  type IndexEntry,
} from "@/lib/palette-index";
import { SOURCE_TYPE_LABEL, isSourceType } from "@/lib/source-types";

export type PaletteAction =
  | { kind: "desk"; desk: Desk }
  | { kind: "place"; place: string }
  | { kind: "source"; sourceId: number }
  | { kind: "watch"; watch: Watchlist }
  | { kind: "search" }
  | { kind: "refresh" }
  | { kind: "help" }
  | { kind: "watch-current" }
  | { kind: "clear-filters" }
  | { kind: "toggle-unread" }
  | { kind: "apply-briefing"; profile: MyBriefingProfile }
  | { kind: "open-saved"; tab: "filters" | "briefing" | "watches" }
  | { kind: "saved-filter"; filters: BoardFilters }
  | { kind: "open-reports" }
  | { kind: "open-user-guide" }
  | { kind: "facet"; facet: FacetInput; label: string; mode: FacetMode }
  | { kind: "trail"; index: number };

/** Enter adds · Shift+Enter dossier · Alt+Enter excludes · Ctrl/⌘+Enter watches. */
export type FacetMode = "add" | "dossier" | "exclude" | "watch";

type Row = {
  id: string;
  label: string;
  hint: string;
  action: PaletteAction;
  /** Kind badge shown before the label. */
  badge?: string;
  count?: number;
  facet?: IndexEntry;
  section?: string;
};

function facetRow(entry: IndexEntry, section?: string): Row {
  return {
    id: `facet-${entryKey(entry)}`,
    label: entry.label,
    hint: entry.hint ?? entryToken(entry),
    badge: KIND_LABEL[entry.kind],
    count: entry.count,
    facet: entry,
    section,
    action: { kind: "facet", facet: { kind: entry.kind, value: entry.value }, label: entry.label, mode: "add" },
  };
}

function modeFromEvent(event: { shiftKey: boolean; altKey: boolean; metaKey: boolean; ctrlKey: boolean }): FacetMode {
  if (event.metaKey || event.ctrlKey) return "watch";
  if (event.altKey) return "exclude";
  if (event.shiftKey) return "dossier";
  return "add";
}

const CHEATSHEET = [
  { keys: "/", action: "Focus search" },
  { keys: "Ctrl/⌘ K", action: "Command palette" },
  { keys: "j / k", action: "Next / previous card" },
  { keys: "Enter", action: "Open focused card" },
  { keys: "h", action: "Hide focused card" },
  { keys: "u", action: "Undo last hide/read" },
  { keys: "r", action: "Send focused story to the open report" },
  { keys: "1–9", action: "Jump desks (Home through Flights)" },
  { keys: "[ / ]", action: "Previous / next view on the trail" },
  { keys: "Palette Enter", action: "Add as filter" },
  { keys: "Palette Shift+Enter", action: "Open dossier" },
  { keys: "Palette Alt+Enter", action: "Exclude" },
  { keys: "Palette Ctrl/⌘+Enter", action: "Watch" },
  { keys: "?", action: "This cheatsheet" },
  { keys: "Esc", action: "Close pane / palette" },
];

export function CommandPalette({
  open,
  mode,
  watches,
  customDesks,
  savedFilters,
  briefing,
  facetIndex,
  oftenWith,
  trail,
  unreadOnly,
  onClose,
  onAction,
}: {
  open: boolean;
  mode: "palette" | "help";
  watches: Watchlist[];
  customDesks: UserDesk[];
  savedFilters: SavedFilter[];
  briefing: MyBriefingProfile | null;
  /** Every facet value on the board with its count (lib/palette-index). */
  facetIndex: IndexEntry[];
  oftenWith: Connection[];
  trail: TrailEntry[];
  unreadOnly: boolean;
  onClose: () => void;
  onAction: (action: PaletteAction) => void;
}) {
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setRecent(loadPaletteRecent());
  }, [open]);

  function run(row: Row, mode: FacetMode) {
    if (row.facet && row.action.kind === "facet") {
      rememberPalettePick(row.facet);
      onAction({ ...row.action, mode });
      return;
    }
    onAction(row.action);
  }

  const rows = useMemo(() => {
    const list: Row[] = [
      { id: "search", label: "Focus search", hint: "/", action: { kind: "search" } },
      { id: "refresh", label: "Refresh layers", hint: "reload", action: { kind: "refresh" } },
      { id: "clear-filters", label: "Clear board filters", hint: "reset", action: { kind: "clear-filters" } },
      {
        id: "toggle-unread",
        label: unreadOnly ? "Show all items (not unread only)" : "Unread only",
        hint: "triage",
        action: { kind: "toggle-unread" },
      },
      { id: "open-saved", label: "Saved views…", hint: "filters", action: { kind: "open-saved", tab: "filters" } },
      { id: "watch-current", label: "Watch this query…", hint: "watchlist", action: { kind: "watch-current" } },
      { id: "open-reports", label: "Open Reports desk", hint: "briefings", action: { kind: "open-reports" } },
      { id: "user-guide", label: "User guide (screenshots)", hint: "/help", action: { kind: "open-user-guide" } },
      { id: "help", label: "Keyboard cheatsheet", hint: "?", action: { kind: "help" } },
    ];
    if (briefing) {
      list.push({
        id: "apply-briefing",
        label: `Apply briefing: ${briefing.name}`,
        hint: "saved",
        action: { kind: "apply-briefing", profile: briefing },
      });
    }
    for (const row of savedFilters.slice(0, 8)) {
      list.push({
        id: `filter-${row.id}`,
        label: `Filter: ${row.name}`,
        hint: "saved",
        action: { kind: "saved-filter", filters: row.filters },
      });
    }
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
    for (const watch of watches) {
      list.push({
        id: `watch-${watch.id}`,
        label: `Watch: ${watch.name}`,
        hint: watch.newHits ? `${watch.newHits} new` : watch.query,
        action: { kind: "watch", watch },
      });
    }
    const { kind, needle } = splitPrefix(q);
    if (kind) return rankEntries(facetIndex, q, { recent, limit: 30 }).map((entry) => facetRow(entry));
    if (!needle) {
      const out: Row[] = [];
      const byKey = new Map(facetIndex.map((entry) => [entryKey(entry), entry]));
      for (const key of recent.slice(0, 6)) {
        const entry = byKey.get(key);
        if (entry) out.push(facetRow(entry, "Recent"));
      }
      trail
        .slice(-4)
        .reverse()
        .forEach((entry, i) => {
          const index = trail.length - 1 - i;
          out.push({
            id: `trail-${index}`,
            label: trailLine(entry),
            hint: "trail",
            badge: "View",
            section: "Recent",
            action: { kind: "trail", index },
          });
        });
      for (const row of oftenWith.slice(0, 6)) {
        const entry = byKey.get(`${row.kind}:${row.value.toLowerCase()}`);
        const label = row.kind === "stype" && isSourceType(row.value) ? SOURCE_TYPE_LABEL[row.value] : row.value;
        out.push({
          ...facetRow(entry ?? { kind: row.kind, value: row.value, label, count: row.together }, "Often with"),
          hint: `${row.lift.toFixed(1)}× here`,
        });
      }
      return [...out, ...list.map((row) => ({ ...row, section: "Commands" }))].slice(0, 30);
    }
    const commands = list.filter((row) => `${row.label} ${row.hint}`.toLowerCase().includes(needle)).slice(0, 8);
    const facets = rankEntries(facetIndex, q, { recent, limit: 22 }).map((entry) => facetRow(entry));
    return [...commands, ...facets];
  }, [briefing, customDesks, facetIndex, oftenWith, q, recent, savedFilters, trail, unreadOnly, watches]);

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
              placeholder="Anything on the board: place, org, person, CVE, type:, family:…"
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
                  if (row) run(row, modeFromEvent(event));
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  onClose();
                }
              }}
            />
            <ul className="max-h-96 overflow-auto py-1">
              {rows.map((row, i) => (
                <li key={row.id}>
                  {row.section && row.section !== rows[i - 1]?.section ? (
                    <div className="palette-section">{row.section}</div>
                  ) : null}
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[12px] ${
                      i === index ? "bg-slate-100 text-slate-900" : "text-slate-700"
                    }`}
                    onMouseEnter={() => setIndex(i)}
                    onClick={(event) => run(row, modeFromEvent(event))}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      {row.badge ? <span className="palette-badge">{row.badge}</span> : null}
                      <span className="min-w-0 truncate">{row.label}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="max-w-[12rem] truncate font-mono text-[10px] text-slate-400">{row.hint}</span>
                      {row.count != null ? <span className="palette-count">{row.count}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="palette-foot">Enter add · Shift+Enter dossier · Alt+Enter exclude · Ctrl/⌘+Enter watch</div>
          </>
        )}
      </div>
    </div>
  );
}
