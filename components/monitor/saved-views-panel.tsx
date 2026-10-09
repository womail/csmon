"use client";

import { useEffect, useState } from "react";
import { Bell, Bookmark, BookmarkCheck, Eye, Save, Trash2 } from "lucide-react";
import { Tip } from "@/components/monitor/tip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BoardFilters } from "@/lib/board-state";
import {
  captureBriefingFromBoard,
  loadMyBriefing,
  saveMyBriefing,
  type MyBriefingProfile,
} from "@/lib/briefing-profile";
import { summarizeQuery } from "@/lib/query-builder";
import {
  deleteSavedFilter,
  loadSavedFilters,
  updateSavedFilterHypotheses,
  upsertSavedFilter,
  type SavedFilter,
} from "@/lib/saved-filters";
import { apiFetch } from "@/lib/api-client";
import type { Desk, Watchlist } from "@/lib/types";

type Tab = "filters" | "briefing" | "watches";

function summarizeFilters(filters: BoardFilters) {
  const bits: string[] = [filters.desk];
  if (filters.platform) bits.push(filters.platform);
  if (filters.topic) bits.push(filters.topic);
  if (filters.place) bits.push(filters.place);
  if (filters.vendor) bits.push(filters.vendor);
  if (filters.q) bits.push(filters.q);
  if (filters.cross) bits.push("2+");
  if (filters.ransomware) bits.push("ransomware");
  if (filters.range !== "24h") bits.push(filters.range);
  if (filters.rising) bits.push("rising");
  const query = summarizeQuery(filters.qb);
  if (query) bits.push(query);
  return bits.join(" · ");
}

export function SavedViewsButton({
  current,
  onApplyFilters,
  watchLine,
  desk,
  watches,
  onWatchesChange,
  onOpenWatch,
  enabledSourceKeys,
  onApplyBriefing,
  open,
  onOpenChange,
  initialTab = "filters",
}: {
  current: BoardFilters;
  onApplyFilters: (filters: BoardFilters) => void;
  watchLine: string;
  desk: Desk;
  watches: Watchlist[];
  onWatchesChange: (rows: Watchlist[]) => void;
  onOpenWatch: (watch: Watchlist) => void;
  enabledSourceKeys: string[];
  onApplyBriefing: (profile: MyBriefingProfile) => void | Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [filterName, setFilterName] = useState("");
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [briefing, setBriefing] = useState<MyBriefingProfile | null>(null);
  const [watchName, setWatchName] = useState("");
  const [notifyUrl, setNotifyUrl] = useState("");
  const [watchError, setWatchError] = useState<string | null>(null);
  const [watchBusy, setWatchBusy] = useState(false);
  const [hypothesisEditId, setHypothesisEditId] = useState<string | null>(null);
  const [hypothesisDraft, setHypothesisDraft] = useState(["", "", ""]);

  const watchHits = watches.reduce((sum, row) => sum + row.newHits, 0);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setSavedFilters(loadSavedFilters());
    setBriefing(loadMyBriefing());
  }, [open, initialTab]);

  async function postWatch(body: Record<string, unknown>) {
    const res = await apiFetch("/api/watchlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { watches?: Watchlist[]; error?: string };
    if (!res.ok) throw new Error(data.error || res.statusText);
    onWatchesChange(data.watches ?? []);
  }

  async function createWatch() {
    if (!watchLine.trim()) {
      setWatchError("Type a search or query on the board first.");
      return;
    }
    setWatchBusy(true);
    setWatchError(null);
    try {
      await postWatch({
        name: watchName.trim() || watchLine.trim(),
        query: watchLine.trim(),
        notifyUrl: notifyUrl.trim() || null,
        desk,
      });
      setWatchName("");
      setNotifyUrl("");
    } catch (err) {
      setWatchError(err instanceof Error ? err.message : "Could not save watch");
    } finally {
      setWatchBusy(false);
    }
  }

  function saveFilter() {
    setSavedFilters(upsertSavedFilter(filterName || summarizeFilters(current), current, savedFilters));
    setFilterName("");
  }

  function saveBriefing() {
    const profile = captureBriefingFromBoard(current, enabledSourceKeys);
    saveMyBriefing(profile);
    setBriefing(profile);
  }

  const badge =
    savedFilters.length + (briefing ? 1 : 0) + (watchHits > 0 ? 1 : 0);

  return (
    <>
      <Tip text="Saved filters, briefing default, and watchlists">
        <Button size="xs" variant="outline" onClick={() => onOpenChange(true)}>
          <Bookmark className="size-3" />
          Saved
          {badge > 0 ? (
            <span className="text-[10px] text-slate-500">
              {watchHits > 0 ? `${watchHits}●` : savedFilters.length || briefing ? "●" : ""}
            </span>
          ) : null}
        </Button>
      </Tip>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Saved views</DialogTitle>
            <p className="text-[12px] text-slate-500">
              One place for named filters, your default briefing board, and alert watches.
            </p>
          </DialogHeader>
          <div className="flex gap-1 border-b border-slate-100 pb-2">
            {(
              [
                ["filters", "Filters"],
                ["briefing", "Briefing"],
                ["watches", "Watches"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                  tab === id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
                onClick={() => setTab(id)}
              >
                {label}
                {id === "watches" && watchHits > 0 ? (
                  <span className="ml-1 text-orange-300">{watchHits}</span>
                ) : null}
              </button>
            ))}
          </div>
          {tab === "filters" ? (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500">
                Saves desk, search, chips, range, and stack in this browser.
              </p>
              <div className="flex gap-1">
                <Input
                  value={filterName}
                  onChange={(event) => setFilterName(event.target.value)}
                  placeholder={summarizeFilters(current)}
                  className="h-8 text-[12px]"
                />
                <Button size="sm" onClick={saveFilter}>
                  Save current
                </Button>
              </div>
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {savedFilters.length === 0 ? (
                  <li className="text-[11px] text-slate-400">No saved filters yet.</li>
                ) : (
                  savedFilters.map((row) => (
                    <li key={row.id} className="rounded px-1 py-1 hover:bg-slate-50">
                      <div className="flex items-start gap-1">
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => {
                            onApplyFilters(row.filters);
                            onOpenChange(false);
                          }}
                        >
                          <span className="block truncate text-[12px] font-medium text-slate-800">
                            {row.name}
                          </span>
                          <span className="block truncate text-[10px] text-slate-400">
                            {summarizeFilters(row.filters)}
                          </span>
                          {row.hypotheses?.length ? (
                            <span className="mt-0.5 block text-[10px] text-violet-700">
                              {row.hypotheses.length} hypothesis
                              {row.hypotheses.length === 1 ? "" : "es"}
                            </span>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          className="rounded px-1 py-0.5 text-[10px] text-slate-500 hover:bg-slate-100"
                          onClick={() => {
                            setHypothesisEditId((current) => (current === row.id ? null : row.id));
                            const lines = row.hypotheses ?? [];
                            setHypothesisDraft([
                              lines[0] ?? "",
                              lines[1] ?? "",
                              lines[2] ?? "",
                            ]);
                          }}
                        >
                          Hypotheses
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-slate-400 hover:text-rose-700"
                          onClick={() => setSavedFilters(deleteSavedFilter(row.id, savedFilters))}
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                      {hypothesisEditId === row.id ? (
                        <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                          <p className="text-[10px] text-slate-500">
                            Up to three lines — tag stories in the reader when this filter is active.
                          </p>
                          {hypothesisDraft.map((line, index) => (
                            <Input
                              key={index}
                              className="h-7 text-[11px]"
                              value={line}
                              placeholder={`Hypothesis ${index + 1}`}
                              onChange={(event) => {
                                const next = [...hypothesisDraft];
                                next[index] = event.target.value;
                                setHypothesisDraft(next);
                              }}
                            />
                          ))}
                          <Button
                            size="sm"
                            onClick={() => {
                              setSavedFilters(
                                updateSavedFilterHypotheses(row.id, hypothesisDraft, savedFilters),
                              );
                              setHypothesisEditId(null);
                            }}
                          >
                            Save hypotheses
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : null}
          {tab === "briefing" ? (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500">
                One default board: desk, filters, 2+ sources, rising, and which layers were enabled
                when you saved.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={saveBriefing}>
                  <Save className="size-3" />
                  Save as my briefing
                </Button>
                {briefing ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      void onApplyBriefing(briefing);
                      onOpenChange(false);
                    }}
                  >
                    <BookmarkCheck className="size-3" />
                    Apply “{briefing.name}”
                  </Button>
                ) : null}
              </div>
              {briefing ? (
                <p className="text-[11px] text-slate-500">
                  Last saved {new Date(briefing.updatedAt).toLocaleString()} · desk {briefing.desk}
                  {briefing.place ? ` · ${briefing.place}` : ""}
                  {briefing.topic ? ` · ${briefing.topic}` : ""}
                  {briefing.cross ? " · 2+" : ""}
                  {briefing.rising ? " · rising" : ""} · {briefing.enabledSourceKeys.length} layers
                </p>
              ) : (
                <p className="text-[11px] text-slate-400">No briefing saved yet.</p>
              )}
            </div>
          ) : null}
          {tab === "watches" ? (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500">
                Query:{" "}
                <span className="font-mono text-slate-700">
                  {watchLine.trim() || "(use board search / query builder)"}
                </span>
              </p>
              <label className="block text-[11px] font-medium text-slate-600">
                Name
                <Input
                  className="mt-1 h-8 text-[12px]"
                  value={watchName}
                  onChange={(event) => setWatchName(event.target.value)}
                  placeholder={watchLine.trim().slice(0, 60) || "Ireland ransomware"}
                />
              </label>
              <label className="block text-[11px] font-medium text-slate-600">
                ntfy URL (optional)
                <Input
                  className="mt-1 h-8 text-[12px]"
                  value={notifyUrl}
                  onChange={(event) => setNotifyUrl(event.target.value)}
                  placeholder="https://ntfy.sh/…"
                />
              </label>
              {watchError ? <p className="text-[11px] text-rose-600">{watchError}</p> : null}
              <div className="flex justify-end">
                <Button size="sm" onClick={() => void createWatch()} disabled={watchBusy}>
                  <Bell className="size-3" />
                  Watch this query
                </Button>
              </div>
              {watches.length ? (
                <ul className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
                  {watches.map((watch) => (
                    <li key={watch.id} className="flex items-center gap-2 py-1.5 text-[12px]">
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left font-medium text-slate-700 hover:text-slate-900"
                        onClick={() => {
                          onOpenWatch(watch);
                          onOpenChange(false);
                        }}
                      >
                        <Eye className="mr-1 inline size-3 opacity-60" />
                        {watch.name}
                        {watch.newHits ? (
                          <span className="ml-1 text-[10px] font-normal text-orange-600">
                            {watch.newHits} new
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        className="text-[10px] text-slate-400 hover:text-rose-600"
                        onClick={() => void postWatch({ delete: watch.id })}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
