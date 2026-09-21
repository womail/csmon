"use client";

import { useEffect, useState } from "react";
import { Bookmark, Trash2 } from "lucide-react";
import { Tip } from "@/components/monitor/tip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BoardFilters } from "@/lib/board-state";
import { boardQueryString } from "@/lib/board-state";
import {
  deleteSavedFilter,
  loadSavedFilters,
  upsertSavedFilter,
  type SavedFilter,
} from "@/lib/saved-filters";

export function SavedFilters({
  current,
  onApply,
}: {
  current: BoardFilters;
  onApply: (filters: BoardFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rows, setRows] = useState<SavedFilter[]>([]);

  useEffect(() => {
    setRows(loadSavedFilters());
  }, []);

  function save() {
    setRows(upsertSavedFilter(name || summarize(current), current, rows));
    setName("");
  }

  return (
    <div className="relative">
      <Tip text="Build and reuse a custom filter from the current board">
        <Button size="xs" variant="outline" onClick={() => setOpen((value) => !value)}>
          <Bookmark className="size-3" />
          Filters
        </Button>
      </Tip>
      {open ? (
        <div className="absolute top-8 right-0 z-30 w-72 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Custom filters
          </div>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            Saves the current desk, search, chips, range, and stack in this browser.
          </p>
          <div className="mt-2 flex gap-1">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={summarize(current)}
              className="h-7 text-[12px]"
            />
            <Button size="xs" onClick={save}>
              Save
            </Button>
          </div>
          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {rows.length === 0 ? (
              <p className="px-1 py-2 text-[11px] text-slate-400">No saved filters yet.</p>
            ) : (
              rows.map((row) => (
                <div key={row.id} className="flex items-start gap-1 rounded px-1 py-1 hover:bg-slate-50">
                  <Tip text={`Apply ${row.name}${boardQueryString(row.filters)}`}>
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        onApply(row.filters);
                        setOpen(false);
                      }}
                    >
                      <span className="block truncate text-[12px] font-medium text-slate-800">
                        {row.name}
                      </span>
                      <span className="block truncate text-[10px] text-slate-400">
                        {summarize(row.filters)}
                      </span>
                    </button>
                  </Tip>
                  <Tip text={`Delete ${row.name}`}>
                    <button
                      type="button"
                      className="rounded p-1 text-slate-400 hover:text-rose-700"
                      onClick={() => setRows(deleteSavedFilter(row.id, rows))}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </Tip>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function summarize(filters: BoardFilters) {
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
  return bits.join(" · ");
}
