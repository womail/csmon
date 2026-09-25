"use client";

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
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
import { UpdateChecker } from "@/components/monitor/update-checker";
import type { MonitorState } from "@/lib/types";

const RANGES: TimeRange[] = ["1h", "6h", "24h", "7d", "all"];

export function OptionsButton({
  onApply,
  onSourcesApplied,
}: {
  onApply: (options: UserOptions) => void;
  onSourcesApplied?: (state: MonitorState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [options, setOptions] = useState<UserOptions>(DEFAULT_OPTIONS);

  useEffect(() => {
    if (open) setOptions(loadOptions());
  }, [open]);

  function commit() {
    saveOptions(options);
    onApply(options);
    setOpen(false);
  }

  return (
    <>
      <Tip text="Language, layout, and what loads when the board is empty">
        <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
          <Settings className="size-3" />
          Options
        </Button>
      </Tip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Board options</DialogTitle>
            <p className="text-[12px] text-slate-500">
              Defaults for this browser. URL filters still win when you share a link.
            </p>
          </DialogHeader>
          <div className="space-y-3 px-1 pb-1">
            <label className="block text-[11px] font-medium text-slate-600">
              Start on desk
              <select
                className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px]"
                value={options.defaultDesk}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, defaultDesk: e.target.value as UserOptions["defaultDesk"] }))
                }
              >
                {DESKS.map((desk) => (
                  <option key={desk.id} value={desk.id}>
                    {desk.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] font-medium text-slate-600">
              Default time range
              <select
                className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px]"
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
            <label className="block text-[11px] font-medium text-slate-600">
              Home location
              <select
                className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px]"
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
            <label className="block text-[11px] font-medium text-slate-600">
              Home language
              <select
                className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px]"
                value={options.homeLanguage}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, homeLanguage: e.target.value }))
                }
              >
                {HOME_LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[12px] text-slate-700">
              <input
                type="checkbox"
                checked={options.autoTranslate}
                onChange={(e) => setOptions((o) => ({ ...o, autoTranslate: e.target.checked }))}
              />
              Auto-translate articles into the home language
            </label>
            <label className="block text-[11px] font-medium text-slate-600">
              Software stack
              <Input
                className="mt-1 h-8 text-[12px]"
                value={options.stack}
                onChange={(e) => setOptions((o) => ({ ...o, stack: e.target.value }))}
                placeholder="microsoft, linux, openssl, chrome"
              />
            </label>
            <label className="block text-[11px] font-medium text-slate-600">
              Palette
              <select
                className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px]"
                value={options.palette}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, palette: e.target.value as UserOptions["palette"] }))
                }
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-[12px] text-slate-700">
              <input
                type="checkbox"
                checked={options.compact}
                onChange={(e) => setOptions((o) => ({ ...o, compact: e.target.checked }))}
              />
              Compact board (narrower cards)
            </label>
            <label className="flex items-center gap-2 text-[12px] text-slate-700">
              <input
                type="checkbox"
                checked={options.autoLoadSecurity}
                onChange={(e) => setOptions((o) => ({ ...o, autoLoadSecurity: e.target.checked }))}
              />
              Auto-load security RSS when the board is empty
            </label>
            <label className="flex items-center gap-2 text-[12px] text-slate-700">
              <input
                type="checkbox"
                checked={options.autoLoadKev}
                onChange={(e) => setOptions((o) => ({ ...o, autoLoadKev: e.target.checked }))}
              />
              Auto-load CISA KEV when Patch is empty
            </label>
            <label className="flex items-center gap-2 text-[12px] text-slate-700">
              <input
                type="checkbox"
                checked={options.autoLoadHazards}
                onChange={(e) => setOptions((o) => ({ ...o, autoLoadHazards: e.target.checked }))}
              />
              Auto-load weather, quake, war, and unrest RSS when empty
            </label>
            <label className="block text-[11px] font-medium text-slate-600">
              Default item retention (days)
              <Input
                type="number"
                min={0}
                className="mt-1 h-8 text-[12px]"
                placeholder="Empty = keep until manual purge"
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
            <UpdateChecker />
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
              <p className="text-[11px] font-medium text-slate-700">Source library</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Inspect every RSS layer, last fetch, and item counts. Edit locally, apply to this
                board, export JSON, then open a PR on GitHub (
                <code className="text-[10px]">lib/intel-feeds.ts</code>).
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
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={commit}>
                Save
              </Button>
            </div>
          </div>
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
