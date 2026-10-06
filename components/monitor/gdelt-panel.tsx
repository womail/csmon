"use client";

import { useEffect, useState } from "react";
import { Globe, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tip } from "@/components/monitor/tip";
import {
  DEFAULT_GDELT_QUERIES,
  GDELT_PACKS,
  GDELT_PRESETS,
  GDELT_TIMESPANS,
  MAX_GDELT_ENABLED,
  MAX_GDELT_QUERIES,
  gdeltSearchText,
  loadGdeltQueries,
  newGdeltQuery,
  normalizeGdeltQueries,
  sanitizeGdeltQuery,
  saveGdeltQueries,
  type GdeltQuery,
  type GdeltTimespan,
} from "@/lib/gdelt";

export function GdeltButton({
  busy,
  onLoad,
  onListChange,
  label = "GDELT",
}: {
  busy?: boolean;
  onLoad: (queries: GdeltQuery[]) => Promise<void> | void;
  onListChange?: (queries: GdeltQuery[]) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [queries, setQueries] = useState<GdeltQuery[]>(DEFAULT_GDELT_QUERIES);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQueries(loadGdeltQueries());
    setHint(null);
  }, [open]);

  function commit(next: GdeltQuery[]) {
    const stored = saveGdeltQueries(next);
    setQueries(next);
    onListChange?.(stored);
    return next;
  }

  function patch(id: string, partial: Partial<GdeltQuery>) {
    const current = queries.find((query) => query.id === id);
    if (!current) return;
    if (partial.enabled && !current.enabled) {
      const enabled = queries.filter((query) => query.enabled).length;
      if (enabled >= MAX_GDELT_ENABLED) {
        setHint(`Only ${MAX_GDELT_ENABLED} queries load at once. Turn one off first.`);
        return;
      }
    }
    setHint(null);
    commit(queries.map((query) => (query.id === id ? { ...query, ...partial } : query)));
  }

  function applyPack(packId: string) {
    const pack = GDELT_PACKS.find((row) => row.id === packId);
    if (!pack) return;
    const presets = GDELT_PRESETS.filter((preset) => pack.presetIds.includes(preset.id));
    let next = [...queries];
    for (const preset of presets) {
      if (next.some((row) => row.id === preset.id)) {
        next = next.map((row) => (row.id === preset.id ? { ...row, enabled: true } : row));
      } else if (next.length < MAX_GDELT_QUERIES) {
        next = [...next, { ...preset, enabled: true }];
      }
    }
    commit(normalizeGdeltQueries(next));
    setHint(`Added pack: ${pack.label}. Turn extras off if you hit the ${MAX_GDELT_ENABLED}-query load cap.`);
  }

  function addPreset(preset: GdeltQuery) {
    if (queries.some((query) => query.id === preset.id)) {
      setHint(`${preset.name} is already in the list.`);
      return;
    }
    if (queries.length >= MAX_GDELT_QUERIES) {
      setHint(`Cap is ${MAX_GDELT_QUERIES} saved queries.`);
      return;
    }
    const enabled = queries.filter((query) => query.enabled).length;
    setHint(null);
    commit([...queries, { ...preset, enabled: enabled < MAX_GDELT_ENABLED && preset.enabled }]);
  }

  function addBlank() {
    if (queries.length >= MAX_GDELT_QUERIES) {
      setHint(`Cap is ${MAX_GDELT_QUERIES} saved queries.`);
      return;
    }
    setHint(null);
    commit([...queries, newGdeltQuery(queries)]);
  }

  async function load() {
    const hadEnabled = queries.filter((query) => query.enabled).length;
    const saved = commit(normalizeGdeltQueries(queries));
    if (!saved.length) {
      setHint("Add a query first.");
      return;
    }
    if (hadEnabled > MAX_GDELT_ENABLED) {
      setHint(`Only ${MAX_GDELT_ENABLED} queries load at once. Extra toggles were turned off.`);
    }
    const invalid = saved.find((query) => query.enabled && !sanitizeGdeltQuery(query.query));
    if (invalid) {
      setHint(`${invalid.name} needs a GDELT search (letters, quotes, theme:, sourcecountry:, tone<-5).`);
      return;
    }
    await onLoad(saved);
    setOpen(false);
  }

  const enabledCount = queries.filter((query) => query.enabled).length;

  return (
    <>
      <Tip text="Tune GDELT news queries and load them as layers">
        <Button type="button" size="xs" variant="outline" onClick={() => setOpen(true)} className="shrink-0">
          <Globe className="size-3" />
          {label}
        </Button>
      </Tip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-[15px]">GDELT</DialogTitle>
            <p className="text-[12px] text-slate-500">
              Global news index. Each row is one saved search, stored as its own layer. At most{" "}
              {MAX_GDELT_ENABLED} run per load, one request every 5 seconds, up to 75 articles each.
            </p>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-3 overflow-y-auto px-1 pb-1">
            <div className="flex flex-wrap gap-1">
              {GDELT_PACKS.map((pack) => (
                <button key={pack.id} type="button" className="tag" onClick={() => applyPack(pack.id)}>
                  {pack.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {GDELT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="tag"
                  onClick={() => addPreset(preset)}
                >
                  + {preset.name}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {queries.map((query) => (
                <div key={query.id} className="rounded-md border border-slate-200 p-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={query.enabled}
                      onCheckedChange={(checked) => patch(query.id, { enabled: checked === true })}
                      aria-label={`Enable ${query.name}`}
                    />
                    <Input
                      className="h-7 flex-1 text-[12px]"
                      value={query.name}
                      onChange={(event) => patch(query.id, { name: event.target.value })}
                      aria-label="Query name"
                    />
                    <button
                      type="button"
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      onClick={() => commit(queries.filter((entry) => entry.id !== query.id))}
                      aria-label={`Remove ${query.name}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <Input
                    className="mt-1.5 h-7 font-mono text-[11px]"
                    value={query.query}
                    onChange={(event) => patch(query.id, { query: event.target.value })}
                    aria-label="GDELT query"
                    placeholder="sourcecountry:ireland"
                  />
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <select
                      className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[12px]"
                      value={query.timespan}
                      onChange={(event) => patch(query.id, { timespan: event.target.value as GdeltTimespan })}
                      aria-label="Timespan"
                    >
                      {GDELT_TIMESPANS.map((span) => (
                        <option key={span} value={span}>
                          {span}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 text-[11px] text-slate-500">
                      Max
                      <Input
                        className="h-7 w-14 text-[12px]"
                        type="number"
                        min={10}
                        max={75}
                        value={query.maxRecords}
                        onChange={(event) => patch(query.id, { maxRecords: Number(event.target.value) })}
                        aria-label="Max articles"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <Checkbox
                        checked={query.englishOnly}
                        onCheckedChange={(checked) => patch(query.id, { englishOnly: checked === true })}
                        aria-label="English only"
                      />
                      English only
                    </label>
                  </div>
                  <p className="mt-1 truncate font-mono text-[10px] text-slate-400">
                    {sanitizeGdeltQuery(query.query)
                      ? gdeltSearchText({ ...query, query: sanitizeGdeltQuery(query.query) as string })
                      : "Needs a GDELT search before it can load."}
                  </p>
                </div>
              ))}
              {queries.length === 0 ? (
                <p className="text-[12px] text-slate-400">No queries yet. Add a preset or a blank row.</p>
              ) : null}
            </div>
            <Button type="button" size="sm" variant="outline" onClick={addBlank}>
              <Plus className="size-3" />
              Add query
            </Button>
            {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
            <p className="text-[11px] text-slate-400">
              {enabledCount} of {MAX_GDELT_ENABLED} will load. Query language: sourcecountry:ireland,
              sourcelang:spanish, theme:PROTEST, tone&lt;-5. Credit the GDELT Project. Opening a story
              still fetches the publisher page.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button type="button" size="sm" onClick={() => void load()} disabled={busy || !queries.length}>
                {enabledCount ? "Load GDELT" : "Turn GDELT off"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
