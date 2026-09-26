"use client";

import dynamic from "next/dynamic";
import { useDeferredValue, useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Layers, Plus, RefreshCw, Search, Shield, ChevronDown, ChevronRight, Undo2, SlidersHorizontal } from "lucide-react";
import { Ago } from "@/components/monitor/ago";
import {
  CacheCard,
  HealthCard,
  ItemCard,
  RankedCard,
  SourceLayerCard,
  StoryCard,
} from "@/components/monitor/cards";
import { PulseCard, TopicMix, TrendList } from "@/components/monitor/charts";
import { FilterTuner } from "@/components/monitor/filter-tuner";
import { QueryBuilderButton } from "@/components/monitor/query-builder";
import { EntityDesk, HomeDashboard } from "@/components/monitor/dashboard";
import { PlacePane } from "@/components/monitor/place-pane";
import { SourcePane } from "@/components/monitor/source-pane";
import { SituationMap, placeMarkers } from "@/components/monitor/map";
import { DeskRail, DeskTabs } from "@/components/monitor/nav";
import { OptionsButton } from "@/components/monitor/options-panel";
import { RedditButton } from "@/components/monitor/reddit-panel";
import { SavedFilters } from "@/components/monitor/saved-filters";
import { ThemeToggle } from "@/components/monitor/theme-toggle";
import { Tip } from "@/components/monitor/tip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import type { BoardFilters } from "@/lib/board-state";
import { defaultBoardFilters, normalizeBoardFilters, syncBoardUrl } from "@/lib/board-state";
import { isKnownTopic, itemHasTopic } from "@/lib/classify";
import {
  clusterItems,
  itemAsStory,
  situationLine,
  storiesFromPool,
  storyContaining,
  type Story,
} from "@/lib/cluster";
import { tagStyle } from "@/lib/colors";
import { documentsFromItems, isDocumentItem } from "@/lib/documents";
import type { AircraftProfile, Flight } from "@/lib/flights";
import { homeCity, type MapMarker } from "@/lib/geo";
import { matchesStack, type KevEntry, type PatchRisk } from "@/lib/kev";
import { matchesLane, type SituationLane } from "@/lib/lanes";
import { kevForStory, itemsForCve, relatedStories, similarStories } from "@/lib/link";
import { isAdvisoryItem, itemHasVendor, matchVendorName, mineItem, vendorFamily } from "@/lib/mine";
import { loadOptions, saveOptions } from "@/lib/options";
import { loadSubreddits, DEFAULT_SUBREDDITS } from "@/lib/reddit";
import { applyPalette } from "@/lib/theme";
import { shortSourceName } from "@/lib/source-label";
import { itemHasPerson, peopleFromItems } from "@/lib/people";
import { isCountry, isKnownPlace, itemHasPlace, PINNED_PLACES, resolvePlace } from "@/lib/places";
import {
  emptyQuery,
  hasQuery,
  itemMatchesQuery,
  summarizeQuery,
  type QueryTree,
} from "@/lib/query-builder";
import type { QuakeEvent } from "@/lib/quakes";
import { rangeStart } from "@/lib/time";
import {
  buildTrends,
  itemMatchesRising,
  minedCves,
  risingKeySet,
} from "@/lib/trends";
import {
  hideKeys,
  itemKey,
  kevKey,
  loadTriage,
  loadTriageUndo,
  persistTriage,
  readKeys,
  storyKeys,
  undoTriage,
  type TriageState,
  type TriageUndo,
} from "@/lib/triage";
import type { Desk, DiscoveredSource, Item, MonitorState, OriginReason, Platform, TimeRange } from "@/lib/types";
import { isBuiltinDesk } from "@/lib/types";
import type { IntelPack } from "@/lib/intel-feeds";
import {
  clampReaderWidth,
  loadActiveReportId,
  loadReaderWidth,
  loadReports,
  READER_WIDTH_DEFAULT,
  saveActiveReportId,
  saveReaderWidth,
  type Report,
} from "@/lib/reports";
import type { WeatherEvent } from "@/lib/weather";
import {
  createUserDesk,
  deleteUserDesk,
  findUserDesk,
  loadUserDesks,
  updateUserDesk,
  type UserDesk,
} from "@/lib/user-desks";

const ReaderPane = dynamic(
  () => import("@/components/monitor/reader").then((mod) => ({ default: mod.ReaderPane })),
  { ssr: false },
);
const ReportsDesk = dynamic(() =>
  import("@/components/monitor/reports").then((mod) => ({ default: mod.ReportsDesk })),
);
const FlightDesk = dynamic(() =>
  import("@/components/monitor/flights").then((mod) => ({ default: mod.FlightDesk })),
);
const AircraftPane = dynamic(() =>
  import("@/components/monitor/flights").then((mod) => ({ default: mod.AircraftPane })),
);
const ScrapeDialog = dynamic(() =>
  import("@/components/monitor/scrape-dialog").then((mod) => ({ default: mod.ScrapeDialog })),
);

const BOARD_PAGE = 80;

const STACK_CHIPS = [
  { label: "AI", kind: "topic" as const, value: "ai" },
  { label: "Sports", kind: "topic" as const, value: "sports" },
  { label: "Reddit", kind: "topic" as const, value: "reddit" },
  { label: "Microsoft", kind: "vendor" as const, value: "Microsoft" },
  { label: "Linux", kind: "vendor" as const, value: "Linux" },
  { label: "Oracle", kind: "vendor" as const, value: "Oracle" },
  { label: "macOS", kind: "vendor" as const, value: "Apple" },
  { label: "Mac", kind: "vendor" as const, value: "Apple" },
];
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
  const res = await apiFetch(url, init);
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
  return vendorFamily(vendor).some((alias) => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(hay);
  });
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
  const deferredQuery = useDeferredValue(query);
  const [boardCap, setBoardCap] = useState(BOARD_PAGE);
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
  const [platform, setPlatform] = useState<Platform | null>(seed.platform);
  const [person, setPerson] = useState<string | null>(seed.person);
  const [rising, setRising] = useState(seed.rising);
  const [qb, setQb] = useState<QueryTree>(seed.qb ?? emptyQuery());
  const [compact, setCompact] = useState(false);
  const [homeLanguage, setHomeLanguage] = useState("en");
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [quakes, setQuakes] = useState<QuakeEvent[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [flightError, setFlightError] = useState<string | null>(null);
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [aircraft, setAircraft] = useState<AircraftProfile | null>(null);
  const [openSourceId, setOpenSourceId] = useState<number | null>(null);
  const [customDesks, setCustomDesks] = useState<UserDesk[]>([]);
  const [deskEditorOpen, setDeskEditorOpen] = useState(false);
  const [editingDesk, setEditingDesk] = useState<UserDesk | null>(null);
  const [homePlace, setHomePlace] = useState("Dublin");
  const [weatherEvents, setWeatherEvents] = useState<WeatherEvent[]>([]);
  const [followOpen, setFollowOpen] = useState(true);
  const [triage, setTriage] = useState<TriageState>({ hidden: [], read: [] });
  const [triageUndo, setTriageUndo] = useState<TriageUndo[]>([]);
  const [subreddits, setSubreddits] = useState<string[]>(DEFAULT_SUBREDDITS);
  const [reports, setReports] = useState<Report[]>([]);
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const [readerWidth, setReaderWidth] = useState(READER_WIDTH_DEFAULT);

  function setState(next: MonitorState) {
    setStateRaw({
      ...next,
      kev: next.kev ?? [],
      hints: next.hints ?? [],
      cache: next.cache ?? { entries: 0, bytes: 0 },
    });
  }

  useEffect(() => {
    setCustomDesks(loadUserDesks());
    const opts = loadOptions();
    applyPalette(opts.palette);
    setCompact(opts.compact);
    setHomeLanguage(opts.homeLanguage);
    setAutoTranslate(opts.autoTranslate);
    setHomePlace(opts.homePlace || "Dublin");
    setTriage(loadTriage());
    setTriageUndo(loadTriageUndo());
    setSubreddits(loadSubreddits());
    setReports(loadReports());
    setOpenReportId(loadActiveReportId());
    setReaderWidth(loadReaderWidth());
    setFollowOpen(window.localStorage.getItem("csmon.follow-open") !== "0");
    if (!seed.stack) {
      setStack(opts.stack || window.localStorage.getItem("csmon.stack") || "");
    }
    const params = new URLSearchParams(window.location.search);
    if (!params.get("desk") && opts.defaultDesk !== "home") setDesk(opts.defaultDesk);
    if (!params.get("range") && opts.defaultRange !== "24h") setRange(opts.defaultRange);
    let cancelled = false;
    const city = homeCity(opts.homePlace || "Dublin");
    const near = city ? `lat=${city.lat}&lng=${city.lng}&km=100&place=${encodeURIComponent(city.name)}` : "";
    (async () => {
      try {
        const empty = initial.sources.filter((source) => source.enabled).length === 0;
        if (opts.autoLoadSecurity && empty) {
          const next = await json<MonitorState>("/api/intel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pack: "security", enable: true }),
          });
          if (!cancelled) setState(next);
        }
        if (opts.autoLoadHazards && empty) {
          const next = await json<MonitorState>("/api/intel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pack: "hazard", enable: true }),
          });
          if (!cancelled) setState(next);
        }
        if (opts.autoLoadKev && !(initial.kev?.length)) {
          const next = await json<MonitorState>("/api/kev", { method: "POST" });
          if (!cancelled) setState(next);
        }
        const [quakeRes, flightRes, weatherRes] = await Promise.all([
          apiFetch("/api/quakes"),
          apiFetch(`/api/flights${near ? `?${near}` : ""}`),
          apiFetch(`/api/weather${near ? `?${near}` : ""}`),
        ]);
        if (quakeRes.ok) {
          const data = (await quakeRes.json()) as { quakes?: QuakeEvent[] };
          if (!cancelled) setQuakes(data.quakes ?? []);
        }
        if (flightRes.ok) {
          const data = (await flightRes.json()) as { flights?: Flight[] };
          if (!cancelled) setFlights(data.flights ?? []);
        } else if (flightRes.status) {
          const data = (await flightRes.json().catch(() => ({}))) as { error?: string };
          if (!cancelled) setFlightError(data.error ?? "ADS-B unavailable");
        }
        if (weatherRes.ok) {
          const data = (await weatherRes.json()) as { events?: WeatherEvent[] };
          if (!cancelled) setWeatherEvents(data.events ?? []);
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
      platform,
      person,
      rising,
      qb,
    });
  }, [cross, desk, layer, origin, person, place, platform, qb, query, range, ransomware, rising, riskFilter, stack, topic, vendor]);

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
  const activeCustom = findUserDesk(desk, customDesks);
  const viewDesk: Desk = activeCustom?.view ?? (isBuiltinDesk(desk) ? desk : "brief");

  useEffect(() => {
    setBoardCap(BOARD_PAGE);
  }, [deferredQuery, layer, origin, person, place, platform, qb, range, rising, topic, vendor, viewDesk]);

  const baseItems = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const needMine = ransomware || Boolean(q);
    return rangedItems.filter((item) => {
      const source = byId.get(item.sourceId);
      if (layer && item.sourceId !== layer) return false;
      if (origin && !source?.origins.some((entry) => entry.reason === origin)) return false;
      if (platform && source?.platform !== platform) return false;
      if (viewDesk === "advisories" && !isAdvisoryItem(item, source)) return false;
      if (viewDesk === "weather" && !matchesLane(item, "weather") && !itemHasTopic(item, "weather")) {
        return false;
      }
      if (viewDesk === "documents" && !isDocumentItem(item)) return false;
      if (topic) {
        if (isKnownPlace(topic) && !isKnownTopic(topic)) {
          if (!itemHasPlace(item, topic)) return false;
        } else if (!itemHasTopic(item, topic)) {
          return false;
        }
      }
      if (place && !itemHasPlace(item, place)) return false;
      if (person && !itemHasPerson(item, person, source)) return false;
      if (triage.hidden.includes(itemKey(item.id))) return false;
      if (vendor && !itemHasVendor(item, vendor)) return false;
      if (needMine) {
        const mined = mineItem(item);
        if (ransomware && !mined.ransomware) return false;
        if (
          q &&
          !`${item.title} ${item.summary ?? ""} ${source?.name ?? ""} ${item.locations.join(" ")} ${mined.cves.join(" ")}`
            .toLowerCase()
            .includes(q)
        ) {
          return false;
        }
      }
      if (!itemMatchesQuery(item, qb, source)) return false;
      return true;
    });
  }, [byId, deferredQuery, layer, origin, person, place, platform, qb, rangedItems, ransomware, topic, triage.hidden, vendor, viewDesk]);

  const trends = useMemo(() => buildTrends(baseItems, range, byId), [baseItems, byId, range]);
  const hotKeys = useMemo(() => risingKeySet(trends), [trends]);
  const cveHits = useMemo(() => minedCves(baseItems).slice(0, 6), [baseItems]);

  const items = useMemo(() => {
    if (!rising) return baseItems;
    return baseItems.filter((item) => itemMatchesRising(item, hotKeys, byId.get(item.sourceId)));
  }, [baseItems, byId, hotKeys, rising]);

  const stories = useMemo(() => {
    const allowed = new Set(items.map((item) => item.id));
    return storiesFromPool(poolStories, allowed, cross, triage.hidden);
  }, [cross, items, poolStories, triage.hidden]);

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
    if (viewDesk === "patch") {
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
  }, [items, state.kev, viewDesk]);

  const kev = useMemo(() => {
    return state.kev
      .filter((entry) => matchesStack(entry, stack))
      .filter((entry) => (riskFilter === "all" ? true : entry.risk === riskFilter))
      .filter((entry) => !ransomware || entry.ransomware)
      .filter((entry) => matchesVendor(`${entry.vendor} ${entry.product}`, vendor))
      .filter((entry) => !triage.hidden.includes(kevKey(entry.cveId)))
      .filter((entry) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return `${entry.cveId} ${entry.vendor} ${entry.product} ${entry.name}`.toLowerCase().includes(q);
      });
  }, [query, ransomware, riskFilter, stack, state.kev, triage.hidden, vendor]);

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
    setError(null);
    try {
      setState(await json<MonitorState>("/api/refresh", { method: "POST" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  async function loadReddit(subs = subreddits) {
    setBusy(true);
    setError(null);
    try {
      setState(
        await json<MonitorState>("/api/reddit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subs, enable: true }),
        }),
      );
      setSubreddits(subs);
      setDesk("home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reddit feed failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadIntel(pack: IntelPack) {
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
      if (pack === "hazard") setDesk("home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Intel pack failed");
    } finally {
      setBusy(false);
    }
  }

  function applyFilters(next: BoardFilters) {
    const filters = normalizeBoardFilters(next);
    setDesk(filters.desk);
    setQuery(filters.q);
    setTopic(filters.topic);
    setPlace(filters.place);
    setRange(filters.range);
    setCross(filters.cross);
    setStack(filters.stack);
    setRiskFilter(filters.risk);
    setVendor(filters.vendor);
    setRansomware(filters.ransomware);
    setLayer(filters.layer);
    setOrigin(filters.origin);
    setPlatform(filters.platform);
    setPerson(filters.person);
    setRising(filters.rising);
    setQb(filters.qb ?? emptyQuery());
  }

  function goHome() {
    const next = defaultBoardFilters(stack);
    applyFilters(next);
    closeReader();
    setOpenSourceId(null);
  }

  function openLane(lane: SituationLane) {
    setTopic((current) => (current === lane ? null : lane));
  }

  function togglePerson(name: string) {
    setPerson((current) => (current === name ? null : name));
  }

  async function loadFlights() {
    setBusy(true);
    setFlightError(null);
    try {
      const city = homeCity(homePlace);
      const qs = city ? `?lat=${city.lat}&lng=${city.lng}&km=100` : "";
      const res = await apiFetch(`/api/flights${qs}`);
      const data = (await res.json()) as { flights?: Flight[]; error?: string };
      if (!res.ok) throw new Error(data.error || "ADS-B failed");
      setFlights(data.flights ?? []);
    } catch (err) {
      setFlightError(err instanceof Error ? err.message : "ADS-B failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadWeather() {
    try {
      const city = homeCity(homePlace);
      const qs = city
        ? `?lat=${city.lat}&lng=${city.lng}&place=${encodeURIComponent(city.name)}`
        : "";
      const res = await apiFetch(`/api/weather${qs}`);
      if (!res.ok) return;
      const data = (await res.json()) as { events?: WeatherEvent[] };
      setWeatherEvents(data.events ?? []);
    } catch {
      /* weather is best-effort */
    }
  }

  function changeHomePlace(name: string) {
    setHomePlace(name);
    const opts = loadOptions();
    saveOptions({ ...opts, homePlace: name });
    const city = homeCity(name);
    const qs = city ? `lat=${city.lat}&lng=${city.lng}&km=100&place=${encodeURIComponent(city.name)}` : "";
    void (async () => {
      try {
        const [flightRes, weatherRes] = await Promise.all([
          apiFetch(`/api/flights${qs ? `?${qs}` : ""}`),
          apiFetch(`/api/weather${qs ? `?${qs}` : ""}`),
        ]);
        if (flightRes.ok) {
          const data = (await flightRes.json()) as { flights?: Flight[] };
          setFlights(data.flights ?? []);
          setFlightError(null);
        }
        if (weatherRes.ok) {
          const data = (await weatherRes.json()) as { events?: WeatherEvent[] };
          setWeatherEvents(data.events ?? []);
        }
      } catch {
        setFlightError("ADS-B failed");
      }
    })();
  }

  async function openAircraft(flight: Flight) {
    setSelectedFlight(flight);
    setAircraft(null);
    closeReader();
    try {
      const res = await apiFetch(`/api/aircraft?icao24=${encodeURIComponent(flight.icao24)}`);
      const data = (await res.json()) as { profile?: AircraftProfile; flight?: Flight };
      if (data.flight) setSelectedFlight(data.flight);
      setAircraft(data.profile ?? null);
    } catch {
      setAircraft(null);
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
    const canon = matchVendorName(name) ?? name;
    setVendor((current) => (current === canon ? null : canon));
  }

  function clickChip(name: string) {
    const vendor = matchVendorName(name);
    if (vendor) {
      toggleVendor(vendor);
      return;
    }
    if (name.toLowerCase() === "ai" || isKnownTopic(name)) {
      toggleTopic(name.toLowerCase() === "ai" ? "ai" : name);
      return;
    }
    focusPlace(name);
  }

  function applyTriage(next: { state: TriageState; undo: TriageUndo[] }) {
    setTriage(next.state);
    setTriageUndo(next.undo);
    persistTriage(next.state, next.undo);
  }

  function hideStory(story: Story) {
    applyTriage(hideKeys(triage, triageUndo, storyKeys(story.id, story.items.map((item) => item.id))));
  }

  function readStory(story: Story) {
    applyTriage(readKeys(triage, triageUndo, storyKeys(story.id, story.items.map((item) => item.id))));
  }

  function hideItem(item: Item) {
    applyTriage(hideKeys(triage, triageUndo, [itemKey(item.id)]));
  }

  function readItem(item: Item) {
    applyTriage(readKeys(triage, triageUndo, [itemKey(item.id)]));
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
    if (openSourceId === id && layer === id) {
      setOpenSourceId(null);
      setLayer(null);
      return;
    }
    const sourceItems = state.items.filter((item) => item.sourceId === id);
    const inWindow = rangedItems.filter((item) => item.sourceId === id);
    setTopic(null);
    setPlace(null);
    setPerson(null);
    setCross(false);
    setQuery("");
    setLayer(id);
    setOpenSourceId(id);
    setSelectedFlight(null);
    setAircraft(null);
    closeReader();
    if (inWindow.length === 0 && sourceItems.length > 0) setRange("all");
    if (viewDesk === "home" || viewDesk === "sources" || viewDesk === "pulse") setDesk("scan");
  }

  function focusCve(cve: string) {
    setQuery(cve);
    const hit = state.kev.find((entry) => entry.cveId === cve);
    if (hit) openReader(kevStory(hit, rangedItems));
  }

  function toggleTopic(name: string) {
    if (isKnownPlace(name) && !isKnownTopic(name)) {
      focusPlace(name);
      return;
    }
    setTopic((current) => (current === name ? null : name));
  }

  function focusPlace(name: string) {
    const next = resolvePlace(name);
    if (place === next) {
      setPlace(null);
      return;
    }
    const placeItems = state.items.filter((item) => itemHasPlace(item, next));
    const inWindow = rangedItems.filter((item) => itemHasPlace(item, next));
    setTopic(null);
    setLayer(null);
    setPerson(null);
    setCross(false);
    setQuery("");
    setOpenSourceId(null);
    setPlace(next);
    setSelectedFlight(null);
    setAircraft(null);
    closeReader();
    if (inWindow.length === 0 && placeItems.length > 0) setRange("all");
    if (viewDesk === "home" || viewDesk === "sources" || viewDesk === "pulse") setDesk("scan");
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

  const emptyBoard =
    items.length === 0 &&
    enabled.length === 0 &&
    viewDesk !== "patch" &&
    viewDesk !== "sources" &&
    viewDesk !== "home" &&
    viewDesk !== "flights" &&
    viewDesk !== "reports";

  const currentFilters: BoardFilters = {
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
    platform,
    person,
    rising,
    qb,
  };

  const catalogTopics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of rangedItems) {
      for (const name of item.topics) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rangedItems]);

  const catalogSources = useMemo(() => {
    const counts = new Map<number, number>();
    for (const item of rangedItems) {
      counts.set(item.sourceId, (counts.get(item.sourceId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({
        id,
        name: byId.get(id)?.name ?? "source",
        count,
        color: byId.get(id)?.color ?? "#94a3b8",
      }));
  }, [byId, rangedItems]);

  const visibleSources = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enabled.filter((source) => {
      if (platform && source.platform !== platform) return false;
      if (origin && !source.origins.some((entry) => entry.reason === origin)) return false;
      const hasItems = items.some((item) => item.sourceId === source.id);
      const nameHit =
        !q ||
        source.name.toLowerCase().includes(q) ||
        (source.handle ?? "").toLowerCase().includes(q) ||
        (source.feedUrl ?? "").toLowerCase().includes(q);
      if (q) return nameHit || hasItems;
      if (topic || place || person || vendor) return hasItems;
      return true;
    });
  }, [enabled, items, origin, person, place, platform, query, topic, vendor]);

  const pinnedPlaceCounts = useMemo(
    () =>
      PINNED_PLACES.map(
        (name) => [name, rangedItems.filter((item) => itemHasPlace(item, name)).length] as const,
      ),
    [rangedItems],
  );

  const people = useMemo(() => peopleFromItems(items, byId), [byId, items]);
  const peopleCatalog = useMemo(() => peopleFromItems(rangedItems, byId), [byId, rangedItems]);
  const documents = useMemo(() => documentsFromItems(items), [items]);

  const mapMarkers: MapMarker[] = useMemo(() => {
    const places = new Map<string, number>();
    for (const item of items) {
      for (const name of item.locations) places.set(name, (places.get(name) ?? 0) + 1);
    }
    return [
      ...placeMarkers(
        [...places.entries()].map(([name, count]) => ({ name, count })),
        "place",
      ),
      ...quakes.slice(0, 16).map((quake) => ({
        id: quake.id,
        name: quake.place.split(",").at(-1)?.trim() || quake.place,
        lat: quake.lat,
        lng: quake.lng,
        kind: "quake" as const,
        hint: `M${quake.mag.toFixed(1)} · ${quake.place}`,
      })),
      ...(viewDesk === "flights" || viewDesk === "home"
        ? flights.map((flight) => ({
            id: flight.icao24,
            name: flight.callsign || flight.icao24,
            lat: flight.lat,
            lng: flight.lng,
            kind: "flight" as const,
            heading: flight.heading,
            hint: `${flight.country} · ${flight.altitude != null ? `${Math.round(flight.altitude)}m` : "airborne"}`,
          }))
        : []),
      ...weatherEvents
        .filter((event) => event.lat != null && event.lng != null)
        .slice(0, 24)
        .map((event) => ({
          id: event.id,
          name: event.place,
          lat: event.lat as number,
          lng: event.lng as number,
          kind: "weather" as const,
          hint: `${event.severity} · ${event.title}`,
        })),
    ];
  }, [desk, flights, items, quakes, weatherEvents]);

  function openTrend(row: { id: string; kind: string }) {
    if (row.kind === "topic") toggleTopic(row.id);
    else if (row.kind === "place") focusPlace(row.id);
    else if (row.kind === "vendor") toggleVendor(row.id);
    else togglePerson(row.id);
  }

  function changeDesk(next: Desk) {
    if (next === desk) return;
    const custom = findUserDesk(next, customDesks);
    if (custom) applyFilters(custom.filters);
    else {
      setQb(emptyQuery());
      setDesk(next);
    }
    if (next === "flights") void loadFlights();
  }

  function openCompiledReport(id: string) {
    setOpenReportId(id);
    saveActiveReportId(id);
    setDesk("reports");
    closeReader();
  }

  function startReaderResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    handle.dataset.active = "1";
    const origin = event.clientX;
    const start = readerWidth;
    let current = start;
    function move(ev: PointerEvent) {
      current = clampReaderWidth(start + (origin - ev.clientX), window.innerWidth);
      setReaderWidth(current);
    }
    function up() {
      handle.dataset.active = "0";
      saveReaderWidth(current);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
    }
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <DeskRail
        desk={desk}
        onChange={changeDesk}
        onHome={goHome}
        counts={{
          home: rangedItems.length,
          brief: stories.length,
          scan: items.length,
          pulse: trends.rising.length + trends.fresh.length,
          weather: rangedItems.filter((item) => matchesLane(item, "weather") || itemHasTopic(item, "weather")).length,
          people: peopleCatalog.length,
          documents: documentsFromItems(rangedItems).length,
          flights: flights.length,
          advisories: advisoryCount,
          patch: p0,
          sources: enabled.length,
          reports: reports.filter((row) => row.status === "open").length,
        }}
        customDesks={customDesks}
        onCreateDesk={() => {
          setEditingDesk(null);
          setDeskEditorOpen(true);
        }}
        onEditDesk={(id) => {
          setEditingDesk(findUserDesk(id, customDesks));
          setDeskEditorOpen(true);
        }}
        onDeleteDesk={(id) => {
          const next = deleteUserDesk(id, customDesks);
          setCustomDesks(next);
          if (desk === id) setDesk("home");
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
          setPlatform(null);
          setPerson(null);
          setRising(false);
          setRiskFilter("p0");
          setQb(emptyQuery());
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col bg-slate-50">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-3 px-3 py-2">
            <Tip text="Home dashboard — click a topic or source to filter in place">
              <button type="button" onClick={goHome} className="flex items-center gap-2">
                <div className="grid size-7 place-items-center rounded-md bg-orange-500 text-[11px] font-bold text-white">
                  cs
                </div>
                <div className="text-left">
                  <div className="text-[13px] leading-none font-semibold tracking-wide">csmon</div>
                  <div className="text-[10px] text-slate-400">home dashboard</div>
                </div>
              </button>
            </Tip>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1.5 left-2 size-3.5 text-slate-400" />
              <Input
                id="board-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  viewDesk === "patch" ? "CVE, vendor, product" : "Filter stories, CVE, vendor  /"
                }
                className="h-7 bg-slate-50 pl-7 text-[12px]"
              />
            </div>
            <div className="rounded-md bg-slate-100 p-0.5 lg:hidden">
              <DeskTabs desk={desk} onChange={changeDesk} customDesks={customDesks} />
            </div>
            <div className="flex rounded-md bg-slate-100 p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={`rounded px-1.5 py-0.5 text-[11px] ${
                    range === r ? "bg-background text-foreground shadow-sm" : "text-slate-500"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <Tip text="Re-fetch enabled layers from cache or origin">
              <Button size="xs" variant="outline" onClick={() => refresh()} disabled={refreshing}>
                <RefreshCw className={refreshing ? "animate-spin" : ""} />
                Refresh
              </Button>
            </Tip>
            <Tip text="Load the CISA Known Exploited Vulnerabilities catalog">
              <Button size="xs" variant="outline" onClick={() => loadKev()} disabled={busy}>
                <Shield className="size-3" />
                KEV
              </Button>
            </Tip>
            <SavedFilters current={currentFilters} onApply={applyFilters} />
            <QueryBuilderButton value={qb} onChange={setQb} />
            <Tip text="Tune topic, place, RSS, and range, then apply or save as a desk">
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  setEditingDesk(findUserDesk(desk, customDesks));
                  setDeskEditorOpen(true);
                }}
              >
                <SlidersHorizontal className="size-3" />
                Tune
              </Button>
            </Tip>
            <ThemeToggle />
            <RedditButton
              busy={busy}
              onListChange={setSubreddits}
              onLoad={(subs) => loadReddit(subs)}
            />
            <OptionsButton
              onSourcesApplied={(next) => setState(next)}
              onApply={(options) => {
                setCompact(options.compact);
                if (options.stack) setStack(options.stack);
                setDesk(options.defaultDesk);
                setRange(options.defaultRange);
                setHomeLanguage(options.homeLanguage);
                setAutoTranslate(options.autoTranslate);
                changeHomePlace(options.homePlace || "");
              }}
            />
            <Tip text="Add a public RSS feed or Bluesky handle">
              <Button size="xs" onClick={() => setScrapeOpen(true)}>
                <Plus />
                RSS
              </Button>
            </Tip>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto px-3 pb-1 text-[11px] text-slate-500">
            {viewDesk === "patch"
              ? `${kev.length} in your stack · ${p0} patch now · ${ransomwareCount} ransomware`
              : viewDesk === "sources"
                ? `${visibleSources.length} ${platform ?? "layers"} · cache ${state.cache.entries} bodies`
                : viewDesk === "home"
                  ? topic || place || platform
                    ? `Filtered to ${[platform, topic, place].filter(Boolean).join(" · ")}`
                    : "Weather · quakes · war · unrest · click Ireland or a topic to filter"
                : viewDesk === "flights"
                  ? homeCity(homePlace)
                    ? `${flights.length} airborne within 100 km of ${homeCity(homePlace)?.name}`
                    : `${flights.length} airborne tracks (world sample)`
                  : viewDesk === "people"
                    ? `${people.length} people on the board`
                    : viewDesk === "documents"
                      ? `${documents.length} reports and advisories`
                  : brief}
          </div>
          <div className="flex flex-wrap content-start gap-1 px-3 pb-2">
            {layer ? (
              <button
                type="button"
                onClick={() => {
                  setLayer(null);
                  setOpenSourceId(null);
                }}
                className="tag"
                style={{ background: "#0f172a", color: "#fff" }}
              >
                {shortSourceName(byId.get(layer)?.name ?? "layer")} ×
              </button>
            ) : null}
            {platform ? (
              <button
                type="button"
                onClick={() => setPlatform(null)}
                className="tag"
                style={{ background: "#0f172a", color: "#fff" }}
              >
                {platform} ×
              </button>
            ) : null}
            {rising ? (
              <button
                type="button"
                onClick={() => setRising(false)}
                className="tag"
                style={{ background: "#15803d", color: "#fff" }}
              >
                rising ×
              </button>
            ) : null}
            {hasQuery(qb) ? (
              <Tip text={summarizeQuery(qb)}>
                <button
                  type="button"
                  onClick={() => setQb(emptyQuery())}
                  className="tag"
                  style={{ background: "#1d4ed8", color: "#fff" }}
                >
                  query ×
                </button>
              </Tip>
            ) : null}
            {place ? (
              <button
                type="button"
                onClick={() => setPlace(null)}
                className="tag"
                style={{ background: "#0e7490", color: "#fff" }}
              >
                {place} ×
              </button>
            ) : null}
            {person ? (
              <button
                type="button"
                onClick={() => setPerson(null)}
                className="tag"
                style={{ background: "#6d28d9", color: "#fff" }}
              >
                {person} ×
              </button>
            ) : null}
            {vendor ? (
              <button
                type="button"
                onClick={() => setVendor(null)}
                className="tag"
                style={{ background: "#9f1239", color: "#fff" }}
              >
                {vendor} ×
              </button>
            ) : null}
            {triageUndo.length > 0 ? (
              <Tip text="Undo the last hide or read">
                <button
                  type="button"
                  onClick={() => applyTriage(undoTriage(triage, triageUndo))}
                  className="tag inline-flex items-center gap-0.5"
                  style={{ background: "#f1f5f9", color: "#334155" }}
                >
                  <Undo2 className="size-2.5" />
                  Undo
                </button>
              </Tip>
            ) : null}
            {viewDesk === "patch" ? (
              <>
                {(["all", "p0", "p1", "p2"] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRiskFilter(id)}
                    className="tag"
                    style={{
                      background: riskFilter === id ? "#0f172a" : "#f1f5f9",
                      color: riskFilter === id ? "#fff" : "#475569",
                    }}
                  >
                    {id === "all" ? "all" : RISK_LABEL[id]}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setRansomware((v) => !v)}
                  className="tag"
                  style={{
                    background: ransomware ? "#9f1239" : "#ffe4e6",
                    color: ransomware ? "#fff" : "#9f1239",
                  }}
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
            ) : (
              <>
                <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                  <Layers className="size-3" />
                  {enabled.length}
                </span>
                <button
                  type="button"
                  onClick={() => setCross((v) => !v)}
                  className="tag"
                  style={{
                    background: cross ? "#0f172a" : "#f1f5f9",
                    color: cross ? "#fff" : "#475569",
                  }}
                >
                  2+ sources
                </button>
                <button
                  type="button"
                  onClick={() => setRansomware((v) => !v)}
                  className="tag"
                  style={{
                    background: ransomware ? "#9f1239" : "#ffe4e6",
                    color: ransomware ? "#fff" : "#9f1239",
                  }}
                >
                  ransomware
                </button>
                {(["intel", "reddit", "explore", "self", "follow"] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setOrigin((current) => (current === id ? null : id))}
                    className="tag"
                    style={{
                      background: origin === id ? "#0f172a" : "#f1f5f9",
                      color: origin === id ? "#fff" : "#475569",
                    }}
                  >
                    {id}
                  </button>
                ))}
                <Tip text="Show items from RSS feeds only, then filter by place or topic">
                  <button
                    type="button"
                    onClick={() => setPlatform((current) => (current === "rss" ? null : "rss"))}
                    className="tag"
                    style={{
                      background: platform === "rss" ? "#0f172a" : "#f1f5f9",
                      color: platform === "rss" ? "#fff" : "#475569",
                    }}
                  >
                    RSS
                  </button>
                </Tip>
                <Tip text={`Keep coverage that is rising or new (${trends.compared})`}>
                  <button
                    type="button"
                    onClick={() => setRising((value) => !value)}
                    className="tag"
                    style={{
                      background: rising ? "#15803d" : "#dcfce7",
                      color: rising ? "#fff" : "#15803d",
                    }}
                  >
                    rising {trends.rising.length + trends.fresh.length}
                  </button>
                </Tip>
                {STACK_CHIPS.map((chip) => {
                  const active =
                    chip.kind === "topic" ? topic === chip.value : vendor === chip.value;
                  const style = tagStyle(chip.kind === "topic" ? chip.value : "cyber");
                  return (
                    <Tip key={chip.label} text={`Filter to ${chip.label}`}>
                      <button
                        type="button"
                        onClick={() =>
                          chip.kind === "topic" ? toggleTopic(chip.value) : toggleVendor(chip.value)
                        }
                        className="tag"
                        style={{
                          background: active ? style.fg : style.bg,
                          color: active ? "#fff" : style.fg,
                        }}
                      >
                        {chip.label}
                      </button>
                    </Tip>
                  );
                })}
                {pinnedPlaceCounts.map(([name, count]) => {
                  const style = tagStyle("place");
                  const active = place === name;
                  return (
                    <Tip key={`pin-${name}`} text={`Everything mentioning ${name} in title or summary`}>
                      <button
                        type="button"
                        onClick={() => focusPlace(name)}
                        className="tag"
                        style={{
                          background: active ? style.fg : style.bg,
                          color: active ? "#fff" : style.fg,
                        }}
                      >
                        {name} {count}
                      </button>
                    </Tip>
                  );
                })}
                {(viewDesk === "home" ? catalogTopics : topics).slice(0, 10).map(([name, count]) => {
                  const style = tagStyle(name);
                  const active = topic === name;
                  return (
                    <Tip key={name} text={active ? `Clear ${name}` : `Filter this desk to ${name}`}>
                      <button
                        type="button"
                        onClick={() => toggleTopic(name)}
                        className="tag"
                        style={{
                          background: active ? style.fg : style.bg,
                          color: active ? "#fff" : style.fg,
                        }}
                      >
                        {name} {count}
                      </button>
                    </Tip>
                  );
                })}
                {places
                  .filter(([name]) => isCountry(name) && !PINNED_PLACES.includes(name as (typeof PINNED_PLACES)[number]))
                  .slice(0, 8)
                  .map(([name, count]) => {
                    const style = tagStyle("place");
                    const active = place === name;
                    return (
                      <button
                        key={`country-${name}`}
                        type="button"
                        onClick={() => focusPlace(name)}
                        className="tag"
                        style={{
                          background: active ? style.fg : style.bg,
                          color: active ? "#fff" : style.fg,
                        }}
                      >
                        {name} {count}
                      </button>
                    );
                  })}
                {places
                  .filter(([name]) => !isCountry(name))
                  .slice(0, 5)
                  .map(([name, count]) => {
                    const style = tagStyle("place");
                    const active = place === name;
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => focusPlace(name)}
                        className="tag"
                        style={{
                          background: active ? style.fg : style.bg,
                          color: active ? "#fff" : style.fg,
                        }}
                      >
                        {name} {count}
                      </button>
                    );
                  })}
                {vendors.slice(0, 6).map(([name, count]) => {
                  const active = vendor === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleVendor(name)}
                      className="tag"
                      style={{
                        background: active ? "#9f1239" : "#fee2e2",
                        color: active ? "#fff" : "#9f1239",
                      }}
                    >
                      {name} {count}
                    </button>
                  );
                })}
                {cveHits.map(([cve, count]) => (
                  <Tip key={cve} text={`Search the board for ${cve}`}>
                    <button
                      type="button"
                      className="tag"
                      style={{
                        background: query.toLowerCase() === cve.toLowerCase() ? "#9f1239" : "#fff7ed",
                        color: query.toLowerCase() === cve.toLowerCase() ? "#fff" : "#9a3412",
                      }}
                      onClick={() => setQuery((current) => (current === cve ? "" : cve))}
                    >
                      {cve} {count}
                    </button>
                  </Tip>
                ))}
                {peopleCatalog.slice(0, 5).map((row) => {
                  const active = person === row.name;
                  return (
                    <Tip key={row.name} text={`Filter to ${row.name}`}>
                      <button
                        type="button"
                        onClick={() => togglePerson(row.name)}
                        className="tag"
                        style={{
                          background: active ? "#6d28d9" : "#ede9fe",
                          color: active ? "#fff" : "#6d28d9",
                        }}
                      >
                        {row.name} {row.count}
                      </button>
                    </Tip>
                  );
                })}
                {viewDesk === "sources" ? (
              <>
                <Tip text="BBC, Guardian, NYT, and other world desks">
                  <Button size="xs" variant="outline" onClick={() => loadIntel("core")} disabled={busy}>
                    World RSS
                  </Button>
                </Tip>
                <Tip text="CISA, Krebs, NCSC, and other security desks">
                  <Button size="xs" variant="outline" onClick={() => loadIntel("security")} disabled={busy}>
                    Security RSS
                  </Button>
                </Tip>
                <Tip text="USGS quakes, NWS/Met Office warnings, Crisis Group">
                  <Button size="xs" variant="outline" onClick={() => loadIntel("hazard")} disabled={busy}>
                    Hazard RSS
                  </Button>
                </Tip>
                <Tip text="Hacker News, Ars, Verge, MIT Tech Review, arXiv AI">
                  <Button size="xs" variant="outline" onClick={() => loadIntel("tech")} disabled={busy}>
                    Tech RSS
                  </Button>
                </Tip>
                <Tip text="CNBC, MarketWatch, BBC Business, Fed, SEC">
                  <Button size="xs" variant="outline" onClick={() => loadIntel("markets")} disabled={busy}>
                    Markets RSS
                  </Button>
                </Tip>
                <Tip text="BBC Sport, Football, Guardian, ESPN, NYT, Sky">
                  <Button size="xs" variant="outline" onClick={() => loadIntel("sports")} disabled={busy}>
                    Sports RSS
                  </Button>
                </Tip>
                <div className="flex w-full basis-full flex-wrap items-center gap-1 border-t border-slate-200/80 pt-1.5">
                  <span className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                    Subreddits
                  </span>
                  {subreddits.map((name) => {
                    const style = tagStyle("reddit");
                    return (
                      <span
                        key={name}
                        className="tag"
                        style={{ background: style.bg, color: style.fg }}
                      >
                        r/{name}
                      </span>
                    );
                  })}
                  <RedditButton
                    busy={busy}
                    label="Manage"
                    onListChange={setSubreddits}
                    onLoad={(subs) => loadReddit(subs)}
                  />
                  <Tip text="Load the combined public Reddit RSS">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => void loadReddit()}
                      disabled={busy || !subreddits.length}
                    >
                      Load Reddit
                    </Button>
                  </Tip>
                </div>
              </>
                ) : null}
              </>
            )}
          </div>
        </header>

        <div
          className={`flex min-h-0 flex-1 flex-col ${openStory ? "lg:flex-row" : "lg:grid lg:grid-cols-[1fr_260px]"}`}
        >
          <main className="min-w-0 flex-1">
            {emptyBoard ? (
              <div className="mx-auto max-w-lg px-6 py-20 text-center">
                <div className="text-lg font-semibold">Start from a desk, not a firehose</div>
                <p className="mt-2 text-[13px] text-slate-500">
                  Brief clusters world coverage. Advisories and Patch are the cyber rail: public
                  RSS plus CISA KEV, filtered to vendor, stack, and ransomware.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button size="sm" onClick={() => loadIntel("core")} disabled={busy}>
                    Load world RSS
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => loadIntel("security")} disabled={busy}>
                    Load security RSS
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => loadIntel("hazard")} disabled={busy}>
                    Load hazards
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => loadIntel("tech")} disabled={busy}>
                    Load tech RSS
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => loadIntel("markets")} disabled={busy}>
                    Load markets RSS
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => loadIntel("sports")} disabled={busy}>
                    Load sports RSS
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => loadKev()} disabled={busy}>
                    Load KEV
                  </Button>
                </div>
                <div className="mt-4 border-t border-slate-200/80 pt-3">
                  <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                    Subreddits
                  </div>
                  <p className="mt-1 text-[12px] text-slate-500">
                    One combined public RSS. Reddit allows about one request per minute.
                  </p>
                  <div className="mt-2 flex flex-wrap justify-center gap-1">
                    {subreddits.map((name) => {
                      const style = tagStyle("reddit");
                      return (
                        <span
                          key={name}
                          className="tag"
                          style={{ background: style.bg, color: style.fg }}
                        >
                          r/{name}
                        </span>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    <RedditButton
                      busy={busy}
                      onListChange={setSubreddits}
                      onLoad={(subs) => loadReddit(subs)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void loadReddit()}
                      disabled={busy || !subreddits.length}
                    >
                      Load Reddit
                    </Button>
                  </div>
                </div>
                {error ? <p className="mt-3 text-[12px] text-red-600">{error}</p> : null}
              </div>
            ) : viewDesk === "patch" ? (
              <div className={`board p-2 ${compact ? "board-compact" : ""}`}>
                <RankedCard title="Vendors to watch" rows={stats.vendorRows} onSelect={toggleVendor} />
                {kev.slice(0, 80).map((entry) => (
                  <KevCard
                    key={entry.cveId}
                    entry={entry}
                    read={triage.read.includes(kevKey(entry.cveId))}
                    onOpen={() => openReader(kevStory(entry, rangedItems))}
                    onVendor={toggleVendor}
                    onHide={() => applyTriage(hideKeys(triage, triageUndo, [kevKey(entry.cveId)]))}
                    onRead={() => applyTriage(readKeys(triage, triageUndo, [kevKey(entry.cveId)]))}
                  />
                ))}
              </div>
            ) : viewDesk === "home" ? (
              <HomeDashboard
                stories={stories}
                items={items}
                catalogTopics={catalogTopics}
                catalogSources={catalogSources}
                people={peopleCatalog}
                quakes={quakes}
                weatherEvents={weatherEvents}
                topic={topic}
                layer={layer}
                person={person}
                place={place}
                platform={platform}
                rising={rising}
                queryActive={hasQuery(qb)}
                onOpenStory={openReader}
                onLane={openLane}
                onTopic={toggleTopic}
                onPlace={focusPlace}
                onSource={focusSource}
                onPerson={togglePerson}
                onVendor={toggleVendor}
                sources={byId}
                compact={compact}
                onHide={hideStory}
                onRead={readStory}
                readKeys={triage.read}
                trends={[...trends.rising, ...trends.fresh].slice(0, 8)}
                trendHint={trends.compared}
                onTrend={openTrend}
              />
            ) : viewDesk === "flights" ? (
              <FlightDesk
                flights={flights}
                selected={selectedFlight}
                profile={aircraft}
                error={flightError}
                onSelect={(flight) => void openAircraft(flight)}
                onRefresh={() => void loadFlights()}
                busy={busy}
                home={homeCity(homePlace)}
                radiusKm={100}
                onHomeChange={changeHomePlace}
              />
            ) : viewDesk === "people" ? (
              <EntityDesk
                title="People"
                hint="Authors and named voices on the current board. Click to filter everything to that person."
                rows={people.map((row) => ({
                  id: row.name,
                  title: row.name,
                  meta: `${row.count} items · ${row.topics.slice(0, 3).join(" · ") || "no topic"} · ${row.sample}`,
                }))}
                onOpen={togglePerson}
              />
            ) : viewDesk === "documents" ? (
              <EntityDesk
                title="Documents"
                hint="Reports, PDFs, and advisory-shaped items. Click to read in place."
                rows={items.filter(isDocumentItem).map((item) => ({
                  id: String(item.id),
                  title: item.title,
                  meta: `${byId.get(item.sourceId)?.name ?? "source"} · ${item.url.replace(/^https?:\/\//, "").slice(0, 48)}`,
                  onOpen: () => openItem(item),
                }))}
                onOpen={() => undefined}
              />
            ) : viewDesk === "reports" ? (
              <ReportsDesk
                reports={reports}
                selectedId={openReportId}
                onSelect={(id) => {
                  setOpenReportId(id);
                  saveActiveReportId(id);
                }}
                onChange={setReports}
              />
            ) : viewDesk === "sources" ? (
              <div className={`board p-2 ${compact ? "board-compact" : ""}`}>
                <CacheCard entries={state.cache.entries} bytes={state.cache.bytes} />
                <HealthCard value={stats.health} fresh={stats.fresh} total={enabled.length} />
                {visibleSources.map((source) => (
                  <SourceLayerCard
                    key={source.id}
                    source={source}
                    itemCount={items.filter((item) => item.sourceId === source.id).length}
                    sample={items.find((item) => item.sourceId === source.id)?.title}
                    active={layer === source.id}
                    onToggle={() => toggleLayer(source.id, true)}
                    onOpen={() => focusSource(source.id)}
                  />
                ))}
              </div>
            ) : (
              <>
              <div className={`board p-2 ${compact ? "board-compact" : ""}`}>
                {viewDesk === "weather" && weatherEvents.length > 0 ? (
                  <section className="card-tile sm:col-span-2">
                    <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                      Weather events
                    </div>
                    <div className="mt-2 space-y-1">
                      {weatherEvents.slice(0, 12).map((event) => (
                        <a
                          key={event.id}
                          href={event.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded px-1 py-1 hover:bg-slate-50"
                        >
                          <span className="text-[12px] font-medium text-slate-800">{event.title}</span>
                          <span className="block text-[10px] text-slate-400">
                            {event.place} · {event.severity}
                            {event.hint ? ` · ${event.hint}` : ""}
                          </span>
                        </a>
                      ))}
                    </div>
                  </section>
                ) : null}
                {viewDesk !== "scan" ? (
                  <>
                    <HealthCard value={stats.health} fresh={stats.fresh} total={enabled.length} />
                    <PulseCard title="Volume" points={stats.volume} />
                    {viewDesk === "pulse" ? (
                      <>
                        <TrendList
                          title="Rising"
                          hint={trends.compared}
                          rows={trends.rising}
                          onSelect={openTrend}
                        />
                        <TrendList title="New" rows={trends.fresh} onSelect={openTrend} />
                        <TrendList title="Falling" rows={trends.falling} onSelect={openTrend} />
                      </>
                    ) : null}
                    {stats.topicRows.length > 0 ? (
                      <TopicMix rows={stats.topicRows} onSelect={toggleTopic} />
                    ) : null}
                    {stats.placeRows.length > 0 ? (
                      <SituationMap
                        title="Where coverage relates"
                        markers={placeMarkers(
                          stats.placeRows.map((row) => ({
                            name: row.label,
                            count: row.value,
                          })),
                        )}
                        onSelect={focusPlace}
                      />
                    ) : null}
                    {stats.placeRows.length > 0 ? (
                      <RankedCard title="Places" rows={stats.placeRows} onSelect={focusPlace} />
                    ) : null}
                    {stats.vendorRows.length > 0 ? (
                      <RankedCard title="Vendors" rows={stats.vendorRows} onSelect={toggleVendor} />
                    ) : null}
                  </>
                ) : null}
                {viewDesk === "scan"
                  ? items.slice(0, boardCap).map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        source={byId.get(item.sourceId)}
                        onTag={clickChip}
                        onPlace={focusPlace}
                        onVendor={toggleVendor}
                        onSource={focusSource}
                        onOpen={() => openItem(item)}
                        onHide={() => hideItem(item)}
                        onRead={() => readItem(item)}
                        read={triage.read.includes(itemKey(item.id))}
                      />
                    ))
                  : viewDesk === "pulse"
                    ? stories.slice(0, 12).map((story) => (
                        <StoryCard
                          key={story.id}
                          story={story}
                          sources={byId}
                          onOpen={() => openReader(story)}
                          onTopic={toggleTopic}
                          onPlace={focusPlace}
                          onVendor={toggleVendor}
                          onSource={focusSource}
                          onHide={() => hideStory(story)}
                          onRead={() => readStory(story)}
                          read={triage.read.includes(`story:${story.id}`)}
                        />
                      ))
                    : stories.slice(0, boardCap).map((story) => (
                        <StoryCard
                          key={story.id}
                          story={story}
                          sources={byId}
                          onOpen={() => openReader(story)}
                          onTopic={toggleTopic}
                          onPlace={focusPlace}
                          onVendor={toggleVendor}
                          onSource={focusSource}
                          onHide={() => hideStory(story)}
                          onRead={() => readStory(story)}
                          read={triage.read.includes(`story:${story.id}`)}
                        />
                      ))}
              </div>
              {viewDesk !== "pulse" &&
              (viewDesk === "scan" ? items.length : stories.length) > boardCap ? (
                <div className="px-2 pb-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBoardCap((current) => current + BOARD_PAGE)}
                  >
                    Show more ({boardCap} of {viewDesk === "scan" ? items.length : stories.length})
                  </Button>
                </div>
              ) : null}
              </>
            )}
          </main>

          {openStory ? (
            <div
              className="flex min-h-[70vh] w-full shrink-0 flex-col border-t border-slate-200 bg-white lg:h-auto lg:min-h-0 lg:w-auto lg:flex-row lg:border-t-0"
              style={{ ["--reader-width" as string]: `${readerWidth}px` }}
            >
              <button
                type="button"
                className="reader-resizer hidden lg:block"
                aria-label="Resize read in place"
                title="Drag to widen the reader"
                onPointerDown={startReaderResize}
                onDoubleClick={() => {
                  const wide = clampReaderWidth(Math.min(1100, window.innerWidth * 0.62), window.innerWidth);
                  const next = readerWidth > wide - 40 ? READER_WIDTH_DEFAULT : wide;
                  setReaderWidth(next);
                  saveReaderWidth(next);
                }}
              />
              <div className="min-h-0 min-w-0 flex-1 lg:w-[var(--reader-width)] lg:flex-none">
                <ReaderPane
                  story={openStory}
                  sources={byId}
                  related={relatedStories(openStory, poolStories)}
                  similar={similarStories(openStory, poolStories)}
                  kevHits={kevForStory(openStory, state.kev)}
                  boardItems={rangedItems}
                  homeLanguage={homeLanguage}
                  autoTranslate={autoTranslate}
                  canBack={trail.length > 0}
                  onBack={backReader}
                  onClose={closeReader}
                  onFollow={followHint}
                  onTopic={toggleTopic}
                  onPlace={focusPlace}
                  onVendor={toggleVendor}
                  onCve={focusCve}
                  onSource={focusSource}
                  onOpenStory={openReader}
                  onOpenItem={openItem}
                  onPerson={togglePerson}
                  reports={reports}
                  onReportsChange={setReports}
                  onOpenReport={openCompiledReport}
                />
              </div>
            </div>
          ) : viewDesk === "flights" && selectedFlight ? (
            <AircraftPane
              flight={selectedFlight}
              profile={aircraft}
              onClose={() => {
                setSelectedFlight(null);
                setAircraft(null);
              }}
            />
          ) : viewDesk !== "flights" && place ? (
            <PlacePane
              place={place}
              items={[...state.items]
                .filter((item) => itemHasPlace(item, place))
                .sort((a, b) => (b.publishedAt ?? b.fetchedAt) - (a.publishedAt ?? a.fetchedAt))}
              rangedCount={rangedItems.filter((item) => itemHasPlace(item, place)).length}
              sources={byId}
              onClose={() => setPlace(null)}
              onOpenItem={openItem}
              onScan={() => {
                setDesk("scan");
                setPlace(place);
              }}
              onTopic={toggleTopic}
              onSource={focusSource}
            />
          ) : viewDesk !== "flights" && openSourceId && byId.get(openSourceId) ? (
            <SourcePane
              source={byId.get(openSourceId)!}
              items={[...state.items]
                .filter((item) => item.sourceId === openSourceId)
                .sort((a, b) => (b.publishedAt ?? b.fetchedAt) - (a.publishedAt ?? a.fetchedAt))}
              rangedCount={rangedItems.filter((item) => item.sourceId === openSourceId).length}
              onClose={() => setOpenSourceId(null)}
              onOpenItem={openItem}
              onScan={() => {
                setDesk("scan");
                setLayer(openSourceId);
              }}
            />
          ) : selectedFlight ? (
            <AircraftPane
              flight={selectedFlight}
              profile={aircraft}
              onClose={() => {
                setSelectedFlight(null);
                setAircraft(null);
              }}
            />
          ) : (
            <aside className="border-t border-slate-200 bg-white lg:border-t-0 lg:border-l">
              <div className="sticky top-[96px] p-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => {
                    const next = !followOpen;
                    setFollowOpen(next);
                    window.localStorage.setItem("csmon.follow-open", next ? "1" : "0");
                  }}
                >
                  <span className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                    Follow next
                  </span>
                  {followOpen ? (
                    <ChevronDown className="size-3.5 text-slate-400" />
                  ) : (
                    <ChevronRight className="size-3.5 text-slate-400" />
                  )}
                </button>
                {followOpen ? (
                  <>
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
                        <span className="block text-[11px] leading-snug font-medium text-slate-800">
                          {shortSourceName(source.name)}
                        </span>
                        <span className="block truncate text-[10px] text-slate-400">
                          {source.origins[0]?.reason ?? source.kind}
                        </span>
                      </span>
                      <span className="text-[10px] text-slate-400">on</span>
                    </button>
                  ))}
                </div>
                  </>
                ) : (
                  <p className="mt-2 text-[11px] text-slate-400">Collapsed. Click to expand the source pool.</p>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      <FilterTuner
        open={deskEditorOpen}
        onOpenChange={(open) => {
          setDeskEditorOpen(open);
          if (!open) setEditingDesk(null);
        }}
        current={currentFilters}
        editing={editingDesk}
        onApply={(filters) =>
          applyFilters(editingDesk ? { ...filters, desk: editingDesk.id } : filters)
        }
        onCreate={(label, filters, view) => {
          const next = createUserDesk(label, filters, customDesks, view);
          setCustomDesks(next);
          if (next[0]) applyFilters(next[0].filters);
        }}
        onUpdate={(id, label, filters, view) => {
          const next = updateUserDesk(id, { label, filters, view }, customDesks);
          setCustomDesks(next);
          const row = next.find((item) => item.id === id);
          if (row) applyFilters(row.filters);
        }}
      />
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

function KevCard({
  entry,
  onOpen,
  onVendor,
  onHide,
  onRead,
  read,
}: {
  entry: KevEntry;
  onOpen: () => void;
  onVendor?: (vendor: string) => void;
  onHide?: () => void;
  onRead?: () => void;
  read?: boolean;
}) {
  return (
    <article className={`card-tile cursor-pointer ${read ? "opacity-55" : ""}`} onClick={onOpen}>
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
          <button
            type="button"
            className="tag"
            style={{ background: "#fee2e2", color: "#9f1239" }}
            onClick={(event) => {
              event.stopPropagation();
              onVendor?.(entry.vendor);
            }}
          >
            {entry.vendor}
          </button>
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
      <div className="mt-2 flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
        {onHide ? (
          <button type="button" className="text-[10px] text-slate-500 hover:text-slate-800" onClick={onHide}>
            Hide
          </button>
        ) : null}
        {onRead ? (
          <button
            type="button"
            className="text-[10px] text-slate-500 hover:text-slate-800"
            onClick={onRead}
            disabled={read}
          >
            {read ? "Read ✓" : "Read"}
          </button>
        ) : null}
      </div>
    </article>
  );
}
