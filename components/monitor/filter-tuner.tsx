"use client";

import { useEffect, useState } from "react";
import type { BuiltinDesk } from "@/lib/types";
import { Tip } from "@/components/monitor/tip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QueryBuilder } from "@/components/monitor/query-builder";
import {
  DESKS,
  normalizeBoardFilters,
  type BoardFilters,
} from "@/lib/board-state";
import { knownTopicTags } from "@/lib/classify";
import { knownPlaceNames } from "@/lib/places";
import { emptyQuery } from "@/lib/query-builder";
import { isBuiltinDesk, type OriginReason, type Platform, type TimeRange } from "@/lib/types";
import { autoDeskLabel, resolveDeskLabel, summarizeDesk, type UserDesk } from "@/lib/user-desks";

const VIEW_DESKS: BuiltinDesk[] = ["home", "brief", "scan", "sources"];
const RANGES: TimeRange[] = ["1h", "6h", "24h", "7d", "all"];
const ORIGINS: (OriginReason | "")[] = ["", "intel", "reddit", "gdelt", "explore", "self", "follow"];
const PLATFORMS: (Platform | "")[] = ["", "rss", "bluesky", "web"];

export function FilterTuner({
  open,
  onOpenChange,
  current,
  editing,
  onApply,
  onCreate,
  onUpdate,
  liveMatchCount,
  liveStoryCount,
  onDraftChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: BoardFilters;
  editing: UserDesk | null;
  onApply: (filters: BoardFilters) => void;
  onCreate: (label: string, filters: BoardFilters, view: BuiltinDesk) => void;
  onUpdate: (id: string, label: string, filters: BoardFilters, view: BuiltinDesk) => void;
  /** Items that would match the draft filters on the chosen desk view. */
  liveMatchCount?: number | null;
  liveStoryCount?: number | null;
  onDraftChange?: (filters: BoardFilters, view: BuiltinDesk) => void;
}) {
  const [label, setLabel] = useState("");
  const [view, setView] = useState<BuiltinDesk>("brief");
  const [draft, setDraft] = useState<BoardFilters>(current);

  useEffect(() => {
    if (!open) return;
    setDraft(editing?.filters ?? current);
    setLabel(editing?.label ?? "");
    setView(
      editing?.view ??
        (isBuiltinDesk(current.desk) && VIEW_DESKS.includes(current.desk) ? current.desk : "brief"),
    );
  }, [open, current, editing]);

  function prepared() {
    return normalizeBoardFilters({
      ...draft,
      desk: view,
    });
  }

  function apply() {
    onApply(prepared());
    onOpenChange(false);
  }

  useEffect(() => {
    if (!open || !onDraftChange) return;
    onDraftChange(normalizeBoardFilters({ ...draft, desk: view }), view);
  }, [draft, onDraftChange, open, view]);

  function saveDesk() {
    const filters = prepared();
    const name = resolveDeskLabel(label, filters);
    if (editing) onUpdate(editing.id, name, filters, view);
    else onCreate(name, filters, view);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[15px]">
            {editing ? `Edit ${editing.label}` : "Tune filters"}
          </DialogTitle>
          <p className="text-[12px] text-slate-500">
            Pick a place such as Ireland (matches title and summary text), limit to RSS layers, then
            apply or pin as a desk.
          </p>
        </DialogHeader>
        <div className="space-y-3 px-1 pb-1">
          <FilterFields value={draft} onChange={setDraft} view={view} onViewChange={setView} />
          <label className="block text-[11px] font-medium text-slate-600">
            Desk name
            <Input
              className="mt-1 h-8 text-[12px]"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={autoDeskLabel(draft)}
            />
          </label>
          <p className="text-[11px] text-slate-500">
            Saves as <span className="font-medium text-slate-700">{resolveDeskLabel(label, prepared())}</span>
            {summarizeDesk(prepared()) ? ` · ${summarizeDesk(prepared())}` : ""}
          </p>
          {liveMatchCount != null ? (
            <p className="tune-live-preview">
              <span className="font-semibold text-foreground">
                {liveMatchCount} item{liveMatchCount === 1 ? "" : "s"}
              </span>
              {liveStoryCount != null && view !== "scan" ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-semibold text-foreground">
                    ~{liveStoryCount} stor{liveStoryCount === 1 ? "y" : "ies"}
                  </span>{" "}
                  after clustering
                </>
              ) : view === "scan" ? (
                " match on Scan"
              ) : (
                " match before clustering"
              )}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Tip text="Apply these filters on the current board without saving a desk">
              <Button size="sm" variant="outline" onClick={apply}>
                Apply
              </Button>
            </Tip>
            <Tip text={editing ? "Update this rail desk" : "Pin these filters on the left rail"}>
              <Button size="sm" onClick={saveDesk}>
                {editing ? "Save desk" : "Create desk"}
              </Button>
            </Tip>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FilterFields({
  value,
  onChange,
  view,
  onViewChange,
}: {
  value: BoardFilters;
  onChange: (next: BoardFilters) => void;
  view: BuiltinDesk;
  onViewChange: (view: BuiltinDesk) => void;
}) {
  const topics = knownTopicTags();
  const places = knownPlaceNames();

  function patch(partial: Partial<BoardFilters>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="block text-[11px] font-medium text-slate-600 sm:col-span-2">
        Search
        <Input
          className="mt-1 h-8 text-[12px]"
          value={value.q}
          onChange={(event) => patch({ q: event.target.value })}
          placeholder="Words in title, summary, source, CVE"
        />
      </label>
      <div className="sm:col-span-2">
        <div className="text-[11px] font-medium text-slate-600">Query</div>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Equals, not equal, contains. Combine rows with AND or OR.
        </p>
        <div className="mt-1.5">
          <QueryBuilder
            value={value.qb ?? emptyQuery()}
            onChange={(qb) => patch({ qb })}
          />
        </div>
      </div>
      <label className="block text-[11px] font-medium text-slate-600">
        Topic
        <Input
          className="mt-1 h-8 text-[12px]"
          list="csmon-topics"
          value={value.topic ?? ""}
          onChange={(event) => patch({ topic: event.target.value || null })}
          placeholder="politics, sports, reddit"
        />
        <datalist id="csmon-topics">
          {topics.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
      <label className="block text-[11px] font-medium text-slate-600">
        Topics (any)
        <Input
          className="mt-1 h-8 text-[12px]"
          value={value.topics.join(", ")}
          onChange={(event) =>
            patch({
              topics: event.target.value
                .split(",")
                .map((t) => t.trim().toLowerCase())
                .filter(Boolean)
                .slice(0, 8),
            })
          }
          placeholder="war, unrest, cyber"
        />
      </label>
      <label className="block text-[11px] font-medium text-slate-600">
        Tags (any)
        <Input
          className="mt-1 h-8 text-[12px]"
          value={value.tags.join(", ")}
          onChange={(event) =>
            patch({
              tags: event.target.value
                .split(",")
                .map((t) => t.trim().toLowerCase())
                .filter(Boolean)
                .slice(0, 8),
            })
          }
          placeholder="soccer, gdelt, ireland"
        />
      </label>
      <label className="block text-[11px] font-medium text-slate-600">
        Place
        <Input
          className="mt-1 h-8 text-[12px]"
          list="csmon-places"
          value={value.place ?? ""}
          onChange={(event) => patch({ place: event.target.value || null })}
          placeholder="Ireland, Dublin, UK"
        />
        <datalist id="csmon-places">
          {places.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
      <label className="block text-[11px] font-medium text-slate-600">
        Sources
        <select
          className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px]"
          value={value.platform ?? ""}
          onChange={(event) => patch({ platform: (event.target.value || null) as Platform | null })}
        >
          {PLATFORMS.map((id) => (
            <option key={id || "all"} value={id}>
              {id === "" ? "All platforms" : id === "rss" ? "RSS feeds only" : id}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[11px] font-medium text-slate-600">
        Origin
        <select
          className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px]"
          value={value.origin ?? ""}
          onChange={(event) => patch({ origin: (event.target.value || null) as OriginReason | null })}
        >
          {ORIGINS.map((id) => (
            <option key={id || "all"} value={id}>
              {id === "" ? "Any origin" : id}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[11px] font-medium text-slate-600">
        Range
        <select
          className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px]"
          value={value.range}
          onChange={(event) => patch({ range: event.target.value as TimeRange })}
        >
          {RANGES.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[11px] font-medium text-slate-600">
        Show as
        <select
          className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px]"
          value={view}
          onChange={(event) => onViewChange(event.target.value as BuiltinDesk)}
        >
          {VIEW_DESKS.map((id) => {
            const meta = DESKS.find((row) => row.id === id);
            return (
              <option key={id} value={id}>
                {meta?.label ?? id}
              </option>
            );
          })}
        </select>
      </label>
      <label className="flex items-center gap-2 text-[11px] font-medium text-slate-600 sm:col-span-2">
        <input
          type="checkbox"
          checked={value.cross}
          onChange={(event) => patch({ cross: event.target.checked })}
        />
        2+ sources only
      </label>
      <label className="flex items-center gap-2 text-[11px] font-medium text-slate-600 sm:col-span-2">
        <input
          type="checkbox"
          checked={value.rising}
          onChange={(event) => patch({ rising: event.target.checked })}
        />
        Rising or new topics only
      </label>
    </div>
  );
}
