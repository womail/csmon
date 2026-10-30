"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, BookOpen, Database, Settings, SlidersHorizontal } from "lucide-react";
import { ClassifierRow } from "@/components/monitor/classifier-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DESKS } from "@/lib/board-state";
import { HOME_CITIES } from "@/lib/geo";
import { HOME_LANGUAGES } from "@/lib/lang";
import {
  DEFAULT_OPTIONS,
  loadOptions,
  saveOptions,
  type UserOptions,
} from "@/lib/options";
import type { TimeRange } from "@/lib/types";
import { Tip } from "@/components/monitor/tip";
import { SourceWorkbench } from "@/components/monitor/source-workbench";
import { AppVersionLine } from "@/components/monitor/app-version";
import { UpdateChecker } from "@/components/monitor/update-checker";
import { MAX_BOARD_ITEM_LIMIT, MIN_BOARD_ITEM_LIMIT } from "@/lib/board-limit";
import {
  REDDIT_RSS_REPLACEMENTS,
  REDDIT_RSS_SUNSET_BANNER,
  REDDIT_RSS_SUNSET_LABEL,
  isRedditRssSunset,
  redditRssDaysUntilSunset,
} from "@/lib/reddit";
import type { MonitorState } from "@/lib/types";

const RANGES: TimeRange[] = ["1h", "6h", "24h", "7d", "all"];

type OptionsTab = "board" | "data" | "system";

function TabButton({
  id,
  active,
  onClick,
  children,
}: {
  id: OptionsTab;
  active: boolean;
  onClick: (id: OptionsTab) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onClick(id)}
      className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
        active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-[11px] font-medium text-slate-600">{children}</span>;
}

const selectClass =
  "mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] dark:border-input dark:bg-background";

export function OptionsButton({
  onApply,
  onSourcesApplied,
}: {
  onApply: (options: UserOptions) => void;
  onSourcesApplied?: (state: MonitorState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<OptionsTab>("board");
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [options, setOptions] = useState<UserOptions>(DEFAULT_OPTIONS);

  useEffect(() => {
    if (open) {
      setOptions(loadOptions());
      setTab("board");
    }
  }, [open]);

  function commit() {
    saveOptions(options);
    onApply(options);
    setOpen(false);
  }

  function openManual() {
    window.open("/help", "_blank", "noopener,noreferrer,width=980,height=860");
  }

  function openStats() {
    window.open("/stats", "_blank", "noopener,noreferrer,width=980,height=820");
  }

  return (
    <>
      <Tip text="Board defaults, data limits, updates, and manual">
        <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
          <Settings className="size-3" />
          Options
        </Button>
      </Tip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton
          className="flex max-h-[min(90vh,780px)] w-[min(calc(100%-1rem),440px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[440px]"
        >
          <DialogHeader className="shrink-0 space-y-1 border-b border-slate-200 px-4 py-3">
            <DialogTitle className="text-[15px]">Options</DialogTitle>
            <AppVersionLine />
          </DialogHeader>

          <div
            className="flex shrink-0 gap-1 border-b border-slate-100 px-3 py-2"
            role="tablist"
            aria-label="Options sections"
          >
            <TabButton id="board" active={tab === "board"} onClick={setTab}>
              <span className="inline-flex items-center gap-1">
                <SlidersHorizontal className="size-3" />
                Board
              </span>
            </TabButton>
            <TabButton id="data" active={tab === "data"} onClick={setTab}>
              <span className="inline-flex items-center gap-1">
                <Database className="size-3" />
                Data
              </span>
            </TabButton>
            <TabButton id="system" active={tab === "system"} onClick={setTab}>
              <span className="inline-flex items-center gap-1">
                <BookOpen className="size-3" />
                Help
              </span>
            </TabButton>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {tab === "board" ? (
              <div className="space-y-3">
                <label className="block">
                  <FieldLabel>Start on desk</FieldLabel>
                  <select
                    className={selectClass}
                    value={options.defaultDesk}
                    onChange={(e) =>
                      setOptions((o) => ({
                        ...o,
                        defaultDesk: e.target.value as UserOptions["defaultDesk"],
                      }))
                    }
                  >
                    {DESKS.map((desk) => (
                      <option key={desk.id} value={desk.id}>
                        {desk.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <FieldLabel>Time range</FieldLabel>
                    <select
                      className={selectClass}
                      value={options.defaultRange}
                      onChange={(e) =>
                        setOptions((o) => ({ ...o, defaultRange: e.target.value as TimeRange }))
                      }
                    >
                      {RANGES.map((range) => (
                        <option key={range} value={range}>
                          {range}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <FieldLabel>Palette</FieldLabel>
                    <select
                      className={selectClass}
                      value={options.palette}
                      onChange={(e) =>
                        setOptions((o) => ({
                          ...o,
                          palette: e.target.value as UserOptions["palette"],
                        }))
                      }
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </label>
                </div>
                <label className="block">
                  <FieldLabel>Home location</FieldLabel>
                  <select
                    className={selectClass}
                    value={options.homePlace}
                    onChange={(e) => setOptions((o) => ({ ...o, homePlace: e.target.value }))}
                  >
                    <option value="">World (no 100 km cap)</option>
                    {HOME_CITIES.map((city) => (
                      <option key={city.name} value={city.name}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <FieldLabel>Home language</FieldLabel>
                  <select
                    className={selectClass}
                    value={options.homeLanguage}
                    onChange={(e) => setOptions((o) => ({ ...o, homeLanguage: e.target.value }))}
                  >
                    {HOME_LANGUAGES.map((lang) => (
                      <option key={lang.id} value={lang.id}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <FieldLabel>Patch stack filter</FieldLabel>
                  <Input
                    className="mt-1 h-8 text-[12px]"
                    value={options.stack}
                    onChange={(e) => setOptions((o) => ({ ...o, stack: e.target.value }))}
                    placeholder="microsoft, linux, openssl"
                  />
                </label>
                <div className="space-y-2 text-[12px] text-slate-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.autoTranslate}
                      onChange={(e) => setOptions((o) => ({ ...o, autoTranslate: e.target.checked }))}
                    />
                    Auto-translate into home language
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.compact}
                      onChange={(e) => setOptions((o) => ({ ...o, compact: e.target.checked }))}
                    />
                    Compact cards
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.autoLoadSecurity}
                      onChange={(e) => setOptions((o) => ({ ...o, autoLoadSecurity: e.target.checked }))}
                    />
                    Auto-load security RSS when empty
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.autoLoadKev}
                      onChange={(e) => setOptions((o) => ({ ...o, autoLoadKev: e.target.checked }))}
                    />
                    Auto-load KEV when Patch is empty
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.autoLoadHazards}
                      onChange={(e) => setOptions((o) => ({ ...o, autoLoadHazards: e.target.checked }))}
                    />
                    Auto-load hazard RSS when empty
                  </label>
                </div>
              </div>
            ) : null}

            {tab === "data" ? (
              <div className="space-y-3">
                <ClassifierRow />
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-[11px] font-medium text-slate-900">ACLED (server)</p>
                  <p className="mt-1 text-[10px] leading-snug text-slate-600">
                    Register at{" "}
                    <a
                      href="https://acleddata.com/data-exploration/access"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline"
                    >
                      myACLED
                    </a>
                    , then set <code className="text-[10px]">ACLED_USERNAME</code> and{" "}
                    <code className="text-[10px]">ACLED_PASSWORD</code> in{" "}
                    <code className="text-[10px]">.env.local</code> and restart. Load layers from header{" "}
                    <strong>ACLED</strong>.
                  </p>
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.autoRefreshMinutes === 30}
                    onChange={(e) =>
                      setOptions((o) => ({ ...o, autoRefreshMinutes: e.target.checked ? 30 : 0 }))
                    }
                  />
                  Auto-refresh every 30 minutes (visible tab only; skips GDELT, Reddit, ACLED)
                </label>
                <div
                  className={`rounded-md border p-2.5 ${
                    isRedditRssSunset()
                      ? "border-amber-300 bg-amber-50"
                      : "border-orange-200 bg-orange-50"
                  }`}
                >
                  <p className="text-[11px] font-medium text-slate-900">Reddit RSS</p>
                  <p className="mt-1 text-[10px] leading-snug text-slate-700">{REDDIT_RSS_SUNSET_BANNER}</p>
                  {!isRedditRssSunset() ? (
                    <p className="mt-1 text-[10px] text-slate-600">
                      Shutdown date: {REDDIT_RSS_SUNSET_LABEL} (about {redditRssDaysUntilSunset()} days).
                    </p>
                  ) : (
                    <p className="mt-1 text-[10px] font-medium text-amber-900">
                      Public RSS has ended. Use header <strong>Reddit → GDELT</strong> to import keyword queries.
                    </p>
                  )}
                  <p className="mt-1 text-[10px] leading-snug text-slate-600">{REDDIT_RSS_REPLACEMENTS}</p>
                </div>
                <label className="block">
                  <FieldLabel>Reddit OAuth app id (script/app — sent to server on Load Reddit)</FieldLabel>
                  <Input
                    className="mt-1 h-8 text-[12px]"
                    value={options.redditOAuthClientId}
                    onChange={(e) => setOptions((o) => ({ ...o, redditOAuthClientId: e.target.value }))}
                    placeholder="Reddit app client id"
                    autoComplete="off"
                  />
                </label>
                <label className="block">
                  <FieldLabel>Reddit OAuth secret (optional, stored in this browser only)</FieldLabel>
                  <Input
                    type="password"
                    className="mt-1 h-8 text-[12px]"
                    value={options.redditOAuthClientSecret}
                    onChange={(e) => setOptions((o) => ({ ...o, redditOAuthClientSecret: e.target.value }))}
                    placeholder="Reddit app secret (server session only, not stored in DB)"
                    autoComplete="off"
                  />
                </label>
                <label className="block">
                  <FieldLabel>Board item limit</FieldLabel>
                  <Input
                    type="number"
                    min={MIN_BOARD_ITEM_LIMIT}
                    max={MAX_BOARD_ITEM_LIMIT}
                    className="mt-1 h-8 text-[12px]"
                    value={options.boardItemLimit}
                    onChange={(e) =>
                      setOptions((o) => ({
                        ...o,
                        boardItemLimit: Math.min(
                          MAX_BOARD_ITEM_LIMIT,
                          Math.max(MIN_BOARD_ITEM_LIMIT, Number(e.target.value) || MIN_BOARD_ITEM_LIMIT),
                        ),
                      }))
                    }
                  />
                  <p className="mt-1 text-[10px] text-slate-500">
                    Recent items from enabled sources ({MIN_BOARD_ITEM_LIMIT}–{MAX_BOARD_ITEM_LIMIT}). Save, then
                    Refresh.
                  </p>
                </label>
                <label className="block">
                  <FieldLabel>Default retention (days)</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    className="mt-1 h-8 text-[12px]"
                    placeholder="Empty = manual purge only"
                    value={options.defaultRetentionDays ?? ""}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setOptions((o) => ({
                        ...o,
                        defaultRetentionDays: v === "" ? null : Math.max(0, Number(v) || 0),
                      }));
                    }}
                  />
                </label>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-[11px] font-medium text-slate-800">Source library</p>
                  <p className="mt-1 text-[10px] leading-snug text-slate-600">
                    Edit RSS layers, then <strong className="font-medium">Save instance overrides</strong> to write{" "}
                    <code className="text-[9px]">data/overrides/feeds.json</code> (beats shipped{" "}
                    <code className="text-[9px]">intel-feeds.ts</code> on this host). Import/export JSON for other
                    servers.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full"
                    onClick={() => {
                      setOpen(false);
                      setSourcesOpen(true);
                    }}
                  >
                    Open source library…
                  </Button>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-[11px] font-medium text-slate-800">Statistical analysis</p>
                  <p className="mt-1 text-[10px] leading-snug text-slate-600">
                    Storage size, cache breakdown, layer counts by origin, and per-query GDELT ingest status (items
                    stored vs cached JSON vs empty).
                  </p>
                  <Button size="sm" variant="outline" className="mt-2 w-full" onClick={openStats}>
                    <BarChart3 className="size-3" />
                    Open analysis…
                  </Button>
                </div>
              </div>
            ) : null}

            {tab === "system" ? (
              <div className="space-y-3">
                <UpdateChecker />
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-[11px] font-medium text-slate-800">Manual & lexicon</p>
                  <p className="mt-1 text-[10px] leading-snug text-slate-600">
                    User guide, maintainer notes (which files to edit), and term definitions — one pop-out.
                  </p>
                  <Button size="sm" variant="outline" className="mt-2 w-full" onClick={openManual}>
                    Open manual…
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-slate-200 px-4 py-3 sm:justify-end">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={commit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SourceWorkbench
        open={sourcesOpen}
        onOpenChange={setSourcesOpen}
        onApplied={onSourcesApplied}
      />
    </>
  );
}
