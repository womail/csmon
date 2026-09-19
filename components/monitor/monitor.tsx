"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers, Plus, RefreshCw, Search, Shield } from "lucide-react";
import { Ago } from "@/components/monitor/ago";
import {
  CacheCard,
  HealthCard,
  ItemCard,
  RankedCard,
  SourceLayerCard,
  StoryCard,
} from "@/components/monitor/cards";
import { PulseCard, TopicMix } from "@/components/monitor/charts";
import { DeskRail, DeskTabs } from "@/components/monitor/nav";
import { ReaderPane } from "@/components/monitor/reader";
import { OptionsButton } from "@/components/monitor/options-panel";
import { ScrapeDialog } from "@/components/monitor/scrape-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BoardFilters } from "@/lib/board-state";
import { syncBoardUrl } from "@/lib/board-state";
import { clusterItems, itemAsStory, situationLine, storyContaining, type Story } from "@/lib/cluster";
import { tagStyle } from "@/lib/colors";
import { matchesStack, type KevEntry, type PatchRisk } from "@/lib/kev";
import { kevForStory, itemsForCve, relatedStories } from "@/lib/link";
import { isAdvisoryItem, mineItem } from "@/lib/mine";
import { loadOptions } from "@/lib/options";
import { rangeStart } from "@/lib/time";
import type { Desk, DiscoveredSource, Item, MonitorState, OriginReason, TimeRange } from "@/lib/types";

const RANGES: TimeRange[] = ["1h", "6h", "24h", "7d", "all"];
const RISK_LABEL: Record<PatchRisk, string> = {
  p0: "Patch now",
  p1: "This window",
  p2: "KEV backlog",
};
const RISK_COLOR: Record<PatchRisk, string> = {
  p0: "#b91c1c",
  p1: "#c2410c",
  p2: "#64748b",
};

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function buckets(items: { publishedAt: number | null; fetchedAt: number }[], range: TimeRange) {
  const n = range === "1h" ? 12 : range === "6h" ? 12 : range === "7d" ? 14 : 24;
  const start = rangeStart(range) || Date.now() - 24 * 3600 * 1000;
  const width = Math.max(1, (Date.now() - start) / n);
  const counts = Array.from({ length: n }, () => 0);
  for (const item of items) {
    const ts = item.publishedAt ?? item.fetchedAt;
    const i = Math.min(n - 1, Math.max(0, Math.floor((ts - start) / width)));
    counts[i] += 1;
  }
  return counts;
}

function matchesVendor(hay: string, vendor: string | null) {
  if (!vendor) return true;
  return hay.toLowerCase().includes(vendor.toLowerCase());
}

export function Monitor({
  initial,
  filters: seed,
}: {
  initial: MonitorState;
  filters: BoardFilters;
}) {
  const [state, setStateRaw] = useState({
    ...initial,
    kev: initial.kev ?? [],
    hints: initial.hints ?? [],
    cache: initial.cache ?? { entries: 0, bytes: 0 },
  });
  const [query, setQuery] = useState(seed.q);
  const [topic, setTopic] = useState<string | null>(seed.topic);
  const [place, setPlace] = useState<string | null>(seed.place);
  const [range, setRange] = useState<TimeRange>(seed.range);
  const [desk, setDesk] = useState<Desk>(seed.desk);
  const [cross, setCross] = useState(seed.cross);
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredSource[]>([]);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layerQuery, setLayerQuery] = useState("");
  const [openStory, setOpenStory] = useState<Story | null>(null);
  const [trail, setTrail] = useState<Story[]>([]);
  const [stack, setStack] = useState(seed.stack);
  const [riskFilter, setRiskFilter] = useState<PatchRisk | "all">(seed.risk);
  const [vendor, setVendor] = useState<string | null>(seed.vendor);
  const [ransomware, setRansomware] = useState(seed.ransomware);
  const [layer, setLayer] = useState<number | null>(seed.layer);
  const [origin, setOrigin] = useState<OriginReason | null>(seed.origin);
  const [compact, setCompact] = useState(false);

  function setState(next: MonitorState) {
    setStateRaw({
      ...next,
      kev: next.kev ?? [],
      hints: next.hints ?? [],
      cache: next.cache ?? { entries: 0, bytes: 0 },
    });
  }

  useEffect(() => {
    const opts = loadOptions();
    setCompact(opts.compact);
    if (!seed.stack) {
      setStack(opts.stack || window.localStorage.getItem("csmon.stack") || "");
    }
    const params = new URLSearchParams(window.location.search);
    if (!params.get("desk") && opts.defaultDesk !== "brief") setDesk(opts.defaultDesk);
    if (!params.get("range") && opts.defaultRange !== "24h") setRange(opts.defaultRange);
    let cancelled = false;
    (async () => {
      try {
        if (opts.autoLoadSecurity && initial.sources.filter((source) => source.enabled).length === 0) {
          const next = await json<MonitorState>("/api/intel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pack: "security", enable: true }),
          });
          if (!cancelled) setState(next);
        }
        if (opts.autoLoadKev && !(initial.kev?.length)) {
          const next = await json<MonitorState>("/api/kev", { method: "POST" });
          if (!cancelled) setState(next);
        }
      } catch {
        /* options bootstrap is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initial.kev?.length, initial.sources, seed.stack]);

  useEffect(() => {
    syncBoardUrl({
      desk,
      q: query,
      topic,
      place,
      range,
      cross,
      stack,
      risk: riskFilter,
      vendor,
      ransomware,
      layer,
      origin,
    });
  }, [cross, desk, layer, origin, place, query, range, ransomware, riskFilter, stack, topic, vendor]);

  const enabled = state.sources.filter((s) => s.enabled);
  const byId = useMemo(
    () => new Map(state.sources.map((s) => [s.id, s])),
    [state.sources],
  );

  const rangedItems = useMemo(() => {
    const start = rangeStart(range);
    return state.items.filter((item) => {
      const source = byId.get(item.sourceId);
      if (!source?.enabled) return false;
      const ts = item.publishedAt ?? item.fetchedAt;
      if (start && ts < start) return false;
      return true;
    });
  }, [byId, range, state.items]);

  const poolStories = useMemo(() => clusterItems(rangedItems), [rangedItems]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rangedItems.filter((item) => {
      const source = byId.get(item.sourceId);
      if (layer && item.sourceId !== layer) return false;
      if (origin && !source?.origins.some((entry) => entry.reason === origin)) return false;
      if (desk === "advisories" && !isAdvisoryItem(item, source)) return false;
      if (topic && !item.topics.includes(topic) && !item.tags.includes(topic)) return false;
      if (place && !item.locations.includes(place)) return false;
      const mined = mineItem(item);
      if (ransomware && !mined.ransomware) return false;
      if (vendor && !matchesVendor(`${item.title} ${mined.vendors.join(" ")}`, vendor)) {
        return false;
      }
      if (
        q &&
        !`${item.title} ${item.summary ?? ""} ${source?.name ?? ""} ${item.locations.join(" ")} ${mined.cves.join(" ")}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [byId, desk, layer, origin, place, query, rangedItems, ransomware, topic, vendor]);

  const stories = useMemo(() => {
    const clustered = clusterItems(items);
    return cross ? clustered.filter((s) => s.sourceIds.length > 1) : clustered;
  }, [cross, items]);

  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      for (const t of item.topics) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const places = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      for (const loc of item.locations) counts.set(loc, (counts.get(loc) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const vendors = useMemo(() => {
    const counts = new Map<string, number>();
    if (desk === "patch") {
      for (const entry of state.kev) {
        counts.set(entry.vendor, (counts.get(entry.vendor) ?? 0) + 1);
      }
    } else {
      for (const item of items) {
        for (const name of mineItem(item).vendors) {
          counts.set(name, (counts.get(name) ?? 0) + 1);
        }
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [desk, items, state.kev]);

  const kev = useMemo(() => {
    return state.kev
      .filter((entry) => matchesStack(entry, stack))
      .filter((entry) => (riskFilter === "all" ? true : entry.risk === riskFilter))
      .filter((entry) => !ransomware || entry.ransomware)
      .filter((entry) => matchesVendor(`${entry.vendor} ${entry.product}`, vendor))
      .filter((entry) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return `${entry.cveId} ${entry.vendor} ${entry.product} ${entry.name}`.toLowerCase().includes(q);
      });
  }, [query, ransomware, riskFilter, stack, state.kev, vendor]);

  const stats = useMemo(() => {
    const sixH = Date.now() - 6 * 60 * 60 * 1000;
    const fresh = enabled.filter((s) => (s.lastFetchedAt ?? 0) >= sixH).length;
    const health = enabled.length ? Math.round((fresh / enabled.length) * 100) : 0;
    const sourceCounts = new Map<number, number>();
    for (const item of state.items) {
      if (byId.get(item.sourceId)?.enabled) {
        sourceCounts.set(item.sourceId, (sourceCounts.get(item.sourceId) ?? 0) + 1);
      }
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
      topicRows: topics.map(([id, value]) => ({
        id,
        label: id,
        value,
        color: tagStyle(id).fg,
      })),
      placeRows: places.map(([id, value]) => ({
        id,
        label: id,
        value,
        color: "#0e7490",
      })),
      vendorRows: vendors.slice(0, 10).map(([id, value]) => ({
        id,
        label: id,
        value,
        color: "#b91c1c",
      })),
      volume: buckets(items, range),
      sourceCounts,
    };
  }, [byId, enabled, items, places, range, state.items, topics, vendors]);

  const hiddenLayers = state.sources.filter((s) => {
    if (s.enabled) return false;
    if (!layerQuery.trim()) return true;
    const q = layerQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.handle ?? "").toLowerCase().includes(q);
  });

  const brief = situationLine(stories, state.sources);
  const p0 = state.kev.filter((k) => k.risk === "p0").length;
  const ransomwareCount = kev.filter((k) => k.ransomware).length;
  const advisoryCount = useMemo(
    () =>
      state.items.filter((item) => {
        const source = byId.get(item.sourceId);
        return source?.enabled && isAdvisoryItem(item, source);
      }).length,
    [byId, state.items],
  );

  async function scrape(input: string, mode: "auto" | "rss" | "bsky" = "auto") {
    setBusy(true);
    setError(null);
    try {
      const data = await json<{
        discovered: DiscoveredSource[];
        state: MonitorState;
      }>("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, mode }),
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
    setState(
      await json<MonitorState>("/api/sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enabledNow ? { disable: [id] } : { enable: [id] }),
      }),
    );
  }

  async function refresh() {
    setRefreshing(true);
    try {
      setState(await json<MonitorState>("/api/refresh", { method: "POST" }));
    } finally {
      setRefreshing(false);
    }
  }

  async function loadIntel(pack: "core" | "security") {
    setBusy(true);
    try {
      setState(
        await json<MonitorState>("/api/intel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pack, enable: true }),
        }),
      );
      if (pack === "security") setDesk("advisories");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Intel pack failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadKev() {
    setBusy(true);
    setError(null);
    try {
      setState(await json<MonitorState>("/api/kev", { method: "POST" }));
      setDesk("patch");
    } catch (err) {
      setError(err instanceof Error ? err.message : "KEV failed");
    } finally {
      setBusy(false);
    }
  }

  async function followHint(url: string) {
    const host = url.replace(/^https?:\/\//, "").split("/")[0];
    setBusy(true);
    try {
      setState(
        await json<MonitorState>("/api/explore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ host, url }),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Follow failed");
    } finally {
      setBusy(false);
    }
  }

  function toggleVendor(name: string) {
    setVendor((current) => (current === name ? null : name));
  }

  function openReader(next: Story) {
    if (openStory && openStory.id !== next.id) {
      setTrail((current) => [...current, openStory]);
    }
    setOpenStory(next);
  }

  function closeReader() {
    setOpenStory(null);
    setTrail([]);
  }

  function backReader() {
    const prev = trail.at(-1) ?? null;
    setTrail((current) => current.slice(0, -1));
    setOpenStory(prev);
  }

  function openItem(item: Item) {
    openReader(storyContaining(item, poolStories) ?? itemAsStory(item));
  }

  function focusSource(id: number) {
    setLayer((current) => (current === id ? null : id));
    if (desk === "sources" || desk === "patch") setDesk("scan");
  }

  function focusCve(cve: string) {
    setQuery(cve);
    const hit = state.kev.find((entry) => entry.cveId === cve);
    if (hit) openReader(kevStory(hit, rangedItems));
  }

  function toggleTopic(name: string) {
    setTopic((current) => (current === name ? null : name));
  }

  function togglePlace(name: string) {
    setPlace((current) => (current === name ? null : name));
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (trail.length) backReader();
        else closeReader();
      }
      if (event.key === "/" && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault();
        document.getElementById("board-search")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trail.length]);

  const emptyBoard = items.length === 0 && enabled.length === 0 && desk !== "patch" && desk !== "sources";

  return (
    <div className="flex min-h-screen">
      <DeskRail
        desk={desk}
        onChange={setDesk}
        counts={{
          brief: stories.length,
          scan: items.length,
          pulse: items.length,
          advisories: advisoryCount,
          patch: p0,
          sources: enabled.length,
        }}
        onClearFilters={() => {
          setQuery("");
          setTopic(null);
          setPlace(null);
          setCross(false);
          setVendor(null);
          setRansomware(false);
          setLayer(null);
          setOrigin(null);
          setRiskFilter("p0");
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="grid size-7 place-items-center rounded-md bg-orange-500 text-[11px] font-bold text-white">
                cs
              </div>
              <div>
                <div className="text-[13px] leading-none font-semibold tracking-wide">csmon</div>
                <div className="text-[10px] text-slate-400">current situation</div>
              </div>
            </div>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1.5 left-2 size-3.5 text-slate-400" />
              <Input
                id="board-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  desk === "patch" ? "CVE, vendor, product" : "Filter stories, CVE, vendor  /"
                }
                className="h-7 bg-slate-50 pl-7 text-[12px]"
              />
            </div>
            <div className="rounded-md bg-slate-100 p-0.5 lg:hidden">
              <DeskTabs desk={desk} onChange={setDesk} />
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
            <Button size="xs" variant="outline" onClick={() => refresh()} disabled={refreshing}>
              <RefreshCw className={refreshing ? "animate-spin" : ""} />
              Refresh
            </Button>
            <Button size="xs" variant="outline" onClick={() => loadKev()} disabled={busy}>
              <Shield className="size-3" />
              KEV
            </Button>
            <OptionsButton
              onApply={(options) => {
                setCompact(options.compact);
                if (options.stack) setStack(options.stack);
                setDesk(options.defaultDesk);
                setRange(options.defaultRange);
              }}
            />
            <Button size="xs" onClick={() => setScrapeOpen(true)}>
              <Plus />
              RSS
            </Button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto px-3 pb-1 text-[11px] text-slate-500">
            {desk === "patch"
              ? `${kev.length} in your stack · ${p0} patch now · ${ransomwareCount} ransomware`
              : desk === "sources"
                ? `${enabled.length} layers · cache ${state.cache.entries} bodies`
                : brief}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto px-3 pb-2">
            {layer ? (
              <button
                type="button"
                onClick={() => setLayer(null)}
                className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-white"
              >
                {byId.get(layer)?.name ?? "layer"} ×
              </button>
            ) : null}
            {desk === "patch" ? (
              <>
                {(["all", "p0", "p1", "p2"] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRiskFilter(id)}
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      riskFilter === id ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {id === "all" ? "all" : RISK_LABEL[id]}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setRansomware((v) => !v)}
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    ransomware ? "bg-rose-800 text-white" : "bg-rose-50 text-rose-800"
                  }`}
                >
                  ransomware
                </button>
                <Input
                  value={stack}
                  onChange={(e) => {
                    setStack(e.target.value);
                    window.localStorage.setItem("csmon.stack", e.target.value);
                  }}
                  placeholder="Your stack: microsoft, openssl, chrome…"
                  className="h-6 w-56 text-[11px]"
                />
              </>
            ) : desk !== "sources" ? (
              <>
                <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                  <Layers className="size-3" />
                  {enabled.length}
                </span>
                <button
                  type="button"
                  onClick={() => setCross((v) => !v)}
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    cross ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  2+ sources
                </button>
                <button
                  type="button"
                  onClick={() => setRansomware((v) => !v)}
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    ransomware ? "bg-rose-800 text-white" : "bg-rose-50 text-rose-800"
                  }`}
                >
                  ransomware
                </button>
                {(["intel", "explore", "self", "follow"] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setOrigin((current) => (current === id ? null : id))}
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      origin === id ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {id}
                  </button>
                ))}
                {topics.slice(0, 8).map(([name, count]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleTopic(name)}
                    className="rounded-full px-2 py-0.5 text-[11px]"
                    style={{
                      background: topic === name ? tagStyle(name).fg : tagStyle(name).bg,
                      color: topic === name ? "#fff" : tagStyle(name).fg,
                    }}
                  >
                    {name} {count}
                  </button>
                ))}
                {places.slice(0, 6).map(([name, count]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => togglePlace(name)}
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      place === name ? "bg-cyan-700 text-white" : "bg-cyan-50 text-cyan-800"
                    }`}
                  >
                    {name} {count}
                  </button>
                ))}
                {vendors.slice(0, 6).map(([name, count]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleVendor(name)}
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      vendor === name ? "bg-red-800 text-white" : "bg-red-50 text-red-800"
                    }`}
                  >
                    {name} {count}
                  </button>
                ))}
              </>
            ) : (
              <>
                <Button size="xs" variant="outline" onClick={() => loadIntel("core")} disabled={busy}>
                  World RSS
                </Button>
                <Button size="xs" variant="outline" onClick={() => loadIntel("security")} disabled={busy}>
                  Security RSS
                </Button>
              </>
            )}
          </div>
        </header>

        <div
          className={`grid flex-1 ${
            openStory ? "lg:grid-cols-[1fr_460px]" : "lg:grid-cols-[1fr_260px]"
          }`}
        >
          <main className="min-w-0">
            {emptyBoard ? (
              <div className="mx-auto max-w-lg px-6 py-20 text-center">
                <div className="text-lg font-semibold">Start from a desk, not a firehose</div>
                <p className="mt-2 text-[13px] text-slate-500">
                  Brief clusters world coverage. Advisories and Patch are the cyber rail: public
                  RSS plus CISA KEV, filtered to vendor, stack, and ransomware.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <Button size="sm" onClick={() => loadIntel("core")} disabled={busy}>
                    Load world RSS
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => loadIntel("security")} disabled={busy}>
                    Load security RSS
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => loadKev()} disabled={busy}>
                    Load KEV
                  </Button>
                </div>
                {error ? <p className="mt-3 text-[12px] text-red-600">{error}</p> : null}
              </div>
            ) : desk === "patch" ? (
              <div className={`board p-2 ${compact ? "board-compact" : ""}`}>
                <RankedCard title="Vendors to watch" rows={stats.vendorRows} onSelect={toggleVendor} />
                {kev.slice(0, 80).map((entry) => (
                  <KevCard
                    key={entry.cveId}
                    entry={entry}
                    onOpen={() => openReader(kevStory(entry, rangedItems))}
                  />
                ))}
              </div>
            ) : desk === "sources" ? (
              <div className={`board p-2 ${compact ? "board-compact" : ""}`}>
                <CacheCard entries={state.cache.entries} bytes={state.cache.bytes} />
                <HealthCard value={stats.health} fresh={stats.fresh} total={enabled.length} />
                {enabled.map((source) => (
                  <SourceLayerCard
                    key={source.id}
                    source={source}
                    itemCount={stats.sourceCounts.get(source.id) ?? 0}
                    sample={rangedItems.find((item) => item.sourceId === source.id)?.title}
                    active={layer === source.id}
                    onToggle={() => toggleLayer(source.id, true)}
                    onOpen={() => {
                      const latest = rangedItems.find((item) => item.sourceId === source.id);
                      setLayer(source.id);
                      setDesk("scan");
                      if (latest) openItem(latest);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className={`board p-2 ${compact ? "board-compact" : ""}`}>
                {desk !== "scan" ? (
                  <>
                    <HealthCard value={stats.health} fresh={stats.fresh} total={enabled.length} />
                    <PulseCard title="Volume" points={stats.volume} />
                    {stats.topicRows.length > 0 ? (
                      <TopicMix rows={stats.topicRows} onSelect={toggleTopic} />
                    ) : null}
                    {stats.placeRows.length > 0 ? (
                      <RankedCard title="Places" rows={stats.placeRows} onSelect={togglePlace} />
                    ) : null}
                    {stats.vendorRows.length > 0 ? (
                      <RankedCard title="Vendors" rows={stats.vendorRows} onSelect={toggleVendor} />
                    ) : null}
                  </>
                ) : null}
                {desk === "scan"
                  ? items.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        source={byId.get(item.sourceId)}
                        onTag={toggleTopic}
                        onSource={focusSource}
                        onOpen={() => openItem(item)}
                      />
                    ))
                  : desk === "pulse"
                    ? stories.slice(0, 12).map((story) => (
                        <StoryCard
                          key={story.id}
                          story={story}
                          sources={byId}
                          onOpen={() => openReader(story)}
                          onTopic={toggleTopic}
                          onPlace={togglePlace}
                          onSource={focusSource}
                        />
                      ))
                    : stories.map((story) => (
                        <StoryCard
                          key={story.id}
                          story={story}
                          sources={byId}
                          onOpen={() => openReader(story)}
                          onTopic={toggleTopic}
                          onPlace={togglePlace}
                          onSource={focusSource}
                        />
                      ))}
              </div>
            )}
          </main>

          {openStory ? (
            <ReaderPane
              story={openStory}
              sources={byId}
              related={relatedStories(openStory, poolStories)}
              kevHits={kevForStory(openStory, state.kev)}
              boardItems={rangedItems}
              canBack={trail.length > 0}
              onBack={backReader}
              onClose={closeReader}
              onFollow={followHint}
              onTopic={toggleTopic}
              onPlace={togglePlace}
              onVendor={toggleVendor}
              onCve={focusCve}
              onSource={focusSource}
              onOpenStory={openReader}
              onOpenItem={openItem}
            />
          ) : (
            <aside className="border-t border-slate-200 bg-white lg:border-t-0 lg:border-l">
              <div className="sticky top-[96px] p-3">
                <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                  Follow next
                </div>
                <div className="mt-2 space-y-1">
                  {state.hints.slice(0, 6).map((hint) => (
                    <button
                      key={hint.host}
                      type="button"
                      onClick={() => followHint(hint.url)}
                      className="block w-full truncate rounded px-1 py-1 text-left text-[11px] hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-800">{hint.host}</span>
                      <span className="text-slate-400"> · {hint.count}</span>
                      <span className="block truncate text-slate-400">{hint.sample}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                  Source pool
                </div>
                <Input
                  value={layerQuery}
                  onChange={(e) => setLayerQuery(e.target.value)}
                  placeholder="Unused sources"
                  className="mt-2 h-7 text-[12px]"
                />
                <div className="mt-2 max-h-[calc(100vh-280px)] space-y-1 overflow-y-auto">
                  {hiddenLayers.slice(0, 60).map((source) => (
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
                        <span className="block truncate text-[12px] text-slate-800">{source.name}</span>
                        <span className="block truncate text-[10px] text-slate-400">
                          {source.origins[0]?.reason ?? source.kind}
                        </span>
                      </span>
                      <span className="text-[10px] text-slate-400">on</span>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          )}
        </div>
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
    </div>
  );
}

function kevStory(entry: KevEntry, boardItems: Item[]): Story {
  const item: Item = {
    id: 0,
    sourceId: 0,
    externalId: entry.cveId,
    title: `${entry.cveId} · ${entry.name}`,
    summary: `${entry.description}\n\n${entry.requiredAction}${entry.notes ? `\n\n${entry.notes}` : ""}`,
    url: entry.url,
    author: entry.vendor,
    publishedAt: entry.dateAdded,
    tags: ["cyber"],
    topics: ["cyber"],
    locations: [],
    fetchedAt: Date.now(),
  };
  const extras = itemsForCve(boardItems, entry.cveId);
  const items = [item, ...extras];
  return {
    id: entry.cveId,
    title: item.title,
    summary: item.summary,
    url: item.url,
    latestAt: entry.dateAdded,
    topics: ["cyber"],
    locations: [],
    tags: ["cyber"],
    items,
    sourceIds: [...new Set(items.map((entryItem) => entryItem.sourceId))],
  };
}

function KevCard({ entry, onOpen }: { entry: KevEntry; onOpen: () => void }) {
  return (
    <article className="card-tile cursor-pointer" onClick={onOpen}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-0.5">
          <span className="tag text-white" style={{ background: RISK_COLOR[entry.risk] }}>
            {RISK_LABEL[entry.risk]}
          </span>
          {entry.ransomware ? (
            <span className="tag" style={{ background: "#fee2e2", color: "#9f1239" }}>
              ransomware
            </span>
          ) : null}
          {entry.overdue ? (
            <span className="tag" style={{ background: "#fff7ed", color: "#c2410c" }}>
              overdue
            </span>
          ) : (
            <span className="tag" style={{ background: "#f1f5f9", color: "#475569" }}>
              {entry.daysUntilDue}d
            </span>
          )}
        </div>
        <Ago ts={entry.dateAdded} className="text-[10px] text-slate-400" />
      </div>
      <p className="mt-1.5 font-mono text-[11px] text-slate-500">{entry.cveId}</p>
      <p className="text-[12.5px] leading-snug font-medium text-slate-800">
        {entry.vendor} {entry.product}
      </p>
      <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-slate-500">
        {entry.name}. {entry.description}
      </p>
      <p className="mt-1.5 text-[10px] text-slate-400">{entry.requiredAction}</p>
    </article>
  );
}
