"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers, Plus, RefreshCw, Search } from "lucide-react";
import { Ago } from "@/components/monitor/ago";
import { HealthCard, ItemCard, RankedCard } from "@/components/monitor/cards";
import { PerformanceNotice } from "@/components/monitor/performance-notice";
import { ScrapeDialog } from "@/components/monitor/scrape-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tagStyle } from "@/lib/colors";
import { rangeStart } from "@/lib/time";
import type { DiscoveredSource, MonitorState, TimeRange } from "@/lib/types";

const RANGES: TimeRange[] = ["1h", "6h", "24h", "7d", "all"];

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export function Monitor({ initial }: { initial: MonitorState }) {
  const [state, setState] = useState(initial);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [range, setRange] = useState<TimeRange>("24h");
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredSource[]>([]);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layerQuery, setLayerQuery] = useState("");

  const enabled = state.sources.filter((s) => s.enabled);
  const byId = useMemo(
    () => new Map(state.sources.map((s) => [s.id, s])),
    [state.sources],
  );

  const items = useMemo(() => {
    const start = rangeStart(range);
    const q = query.trim().toLowerCase();
    return state.items.filter((item) => {
      const source = byId.get(item.sourceId);
      if (!source?.enabled) return false;
      const ts = item.publishedAt ?? item.fetchedAt;
      if (start && ts < start) return false;
      if (tag && !item.tags.includes(tag)) return false;
      if (
        q &&
        !`${item.title} ${item.summary ?? ""} ${source.name}`.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [byId, query, range, state.items, tag]);

  const stats = useMemo(() => {
    const sixH = Date.now() - 6 * 60 * 60 * 1000;
    const fresh = enabled.filter((s) => (s.lastFetchedAt ?? 0) >= sixH).length;
    const health = enabled.length ? Math.round((fresh / enabled.length) * 100) : 0;
    const sourceCounts = new Map<number, number>();
    const tagCounts = new Map<string, number>();
    for (const item of items) {
      sourceCounts.set(item.sourceId, (sourceCounts.get(item.sourceId) ?? 0) + 1);
      for (const t of item.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
    return {
      health,
      fresh,
      sourceRows: [...sourceCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, value]) => ({
          id: String(id),
          label: byId.get(id)?.name ?? "source",
          value,
          color: byId.get(id)?.color ?? "#94a3b8",
        })),
      tagRows: [...tagCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, value]) => ({
          id,
          label: id,
          value,
          color: tagStyle(id).fg,
        })),
    };
  }, [byId, enabled, items]);

  const hiddenLayers = state.sources.filter((s) => {
    if (s.enabled) return false;
    if (!layerQuery.trim()) return true;
    const q = layerQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) || (s.handle ?? "").toLowerCase().includes(q)
    );
  });

  async function scrape(input: string) {
    setBusy(true);
    setError(null);
    try {
      const data = await json<{
        discovered: DiscoveredSource[];
        state: MonitorState;
      }>("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      setDiscovered(data.discovered);
      setState(data.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scrape failed");
    } finally {
      setBusy(false);
    }
  }

  async function addLayers(keys: string[]) {
    setBusy(true);
    setError(null);
    try {
      const selected = state.sources.filter((s) => keys.includes(s.key)).map((s) => s.id);
      const discoveredIds = state.sources
        .filter((s) => discovered.some((d) => d.key === s.key))
        .map((s) => s.id);
      const disable = discoveredIds.filter((id) => !selected.includes(id));
      const next = await json<MonitorState>("/api/sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable: selected, disable }),
      });
      setState(next);
      setScrapeOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add layers");
    } finally {
      setBusy(false);
    }
  }

  async function toggleLayer(id: number, enabledNow: boolean) {
    const next = await json<MonitorState>("/api/sources", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enabledNow ? { disable: [id] } : { enable: [id] }),
    });
    setState(next);
  }

  async function refresh() {
    setRefreshing(true);
    try {
      setState(await json<MonitorState>("/api/refresh", { method: "POST" }));
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "/" && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault();
        document.getElementById("board-search")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-md bg-orange-500 text-[11px] font-bold text-white">
              cs
            </div>
            <div>
              <div className="text-[13px] leading-none font-semibold tracking-wide">
                csmon
              </div>
              <div className="text-[10px] text-slate-400">current situation</div>
            </div>
          </div>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1.5 left-2 size-3.5 text-slate-400" />
            <Input
              id="board-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter items  /"
              className="h-7 bg-slate-50 pl-7 text-[12px]"
            />
          </div>
          <div className="flex rounded-md bg-slate-100 p-0.5">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded px-1.5 py-0.5 text-[11px] ${
                  range === r ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <Button
            size="xs"
            variant="outline"
            onClick={() => refresh()}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Button size="xs" onClick={() => setScrapeOpen(true)}>
            <Plus />
            Scrape user
          </Button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto px-3 pb-2">
          <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            <Layers className="size-3" />
            {enabled.length} layers
          </span>
          {enabled.map((source) => (
            <button
              key={source.id}
              type="button"
              onClick={() => toggleLayer(source.id, true)}
              className="flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700"
              title="Click to disable layer"
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: source.color }}
              />
              {source.name}
              <Ago
                ts={source.lastFetchedAt}
                className="text-slate-400"
              />
            </button>
          ))}
          {tag ? (
            <button
              type="button"
              onClick={() => setTag(null)}
              className="rounded-full px-2 py-0.5 text-[11px] text-white"
              style={{ background: tagStyle(tag).fg }}
            >
              tag:{tag} ×
            </button>
          ) : null}
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_260px]">
        <main className="min-w-0">
          {items.length === 0 && enabled.length === 0 ? (
            <div className="mx-auto max-w-md px-6 py-24 text-center">
              <div className="text-lg font-semibold">No layers yet</div>
              <p className="mt-2 text-[13px] text-slate-500">
                Scrape a public user to harvest sources. Filter who they follow,
                mention, and link, then pin the useful ones as layers.
              </p>
              <Button className="mt-4" size="sm" onClick={() => setScrapeOpen(true)}>
                Scrape user
              </Button>
            </div>
          ) : (
            <div className="board p-2">
              {enabled.length > 0 ? (
                <HealthCard
                  value={stats.health}
                  fresh={stats.fresh}
                  total={enabled.length}
                />
              ) : null}
              {stats.sourceRows.length > 0 ? (
                <RankedCard
                  title="Volume"
                  rows={stats.sourceRows}
                  onSelect={(id) => {
                    const source = byId.get(Number(id));
                    if (source) setQuery(source.name);
                  }}
                />
              ) : null}
              {stats.tagRows.length > 0 ? (
                <RankedCard title="Tags" rows={stats.tagRows} onSelect={setTag} />
              ) : null}
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  source={byId.get(item.sourceId)}
                  onTag={setTag}
                />
              ))}
            </div>
          )}
        </main>

        <aside className="border-t border-slate-200 bg-white lg:border-t-0 lg:border-l">
          <div className="sticky top-[72px] p-3">
            <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
              Source pool
            </div>
            <Input
              value={layerQuery}
              onChange={(e) => setLayerQuery(e.target.value)}
              placeholder="Filter unused sources"
              className="mt-2 h-7 text-[12px]"
            />
            <div className="mt-2 max-h-[calc(100vh-140px)] space-y-1 overflow-y-auto">
              {hiddenLayers.slice(0, 80).map((source) => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => toggleLayer(source.id, false)}
                  className="flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left hover:bg-slate-50"
                >
                  <span
                    className="mt-1 size-1.5 shrink-0 rounded-full"
                    style={{ background: source.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] text-slate-800">
                      {source.name}
                    </span>
                    <span className="block truncate text-[10px] text-slate-400">
                      {source.origins[0]?.reason ?? source.kind} · {source.platform}
                    </span>
                  </span>
                  <span className="text-[10px] text-slate-400">on</span>
                </button>
              ))}
              {hiddenLayers.length === 0 ? (
                <p className="text-[11px] text-slate-400">
                  Scraped sources you have not pinned show up here.
                </p>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

      <ScrapeDialog
        open={scrapeOpen}
        onOpenChange={setScrapeOpen}
        busy={busy}
        error={error}
        discovered={discovered}
        onScrape={scrape}
        onAdd={addLayers}
      />
      <PerformanceNotice layerCount={enabled.length} />
    </div>
  );
}
