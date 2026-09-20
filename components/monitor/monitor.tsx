"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers, Plus, RefreshCw, Search, Shield, ChevronDown, ChevronRight, Undo2 } from "lucide-react";
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
import { DeskEditor } from "@/components/monitor/desk-editor";
import { EntityDesk, HomeDashboard } from "@/components/monitor/dashboard";
import { AircraftPane, FlightDesk } from "@/components/monitor/flights";
import { PlacePane } from "@/components/monitor/place-pane";
import { SourcePane } from "@/components/monitor/source-pane";
import { SituationMap, placeMarkers } from "@/components/monitor/map";
import { DeskRail, DeskTabs } from "@/components/monitor/nav";
import { OptionsButton } from "@/components/monitor/options-panel";
import { ReaderPane } from "@/components/monitor/reader";
import { RedditButton } from "@/components/monitor/reddit-panel";
import { SavedFilters } from "@/components/monitor/saved-filters";
import { ScrapeDialog } from "@/components/monitor/scrape-dialog";
import { ThemeToggle } from "@/components/monitor/theme-toggle";
import { Tip } from "@/components/monitor/tip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BoardFilters } from "@/lib/board-state";
import { defaultBoardFilters, syncBoardUrl } from "@/lib/board-state";
import { isKnownTopic, itemHasTopic } from "@/lib/classify";
import { clusterItems, itemAsStory, situationLine, storyContaining, type Story } from "@/lib/cluster";
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
import { isCountry, itemHasPlace, resolvePlace } from "@/lib/places";
import type { QuakeEvent } from "@/lib/quakes";
import { rangeStart } from "@/lib/time";
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
import type { Desk, DiscoveredSource, Item, MonitorState, OriginReason, TimeRange } from "@/lib/types";
import type { IntelPack } from "@/lib/intel-feeds";
import type { WeatherEvent } from "@/lib/weather";
import {
  createUserDesk,
  deleteUserDesk,
  findUserDesk,
  loadUserDesks,
  type UserDesk,
} from "@/lib/user-desks";

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
  const [person, setPerson] = useState<string | null>(seed.person);
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
  const [homePlace, setHomePlace] = useState("Dublin");
  const [weatherEvents, setWeatherEvents] = useState<WeatherEvent[]>([]);
  const [followOpen, setFollowOpen] = useState(true);
  const [triage, setTriage] = useState<TriageState>({ hidden: [], read: [] });
  const [triageUndo, setTriageUndo] = useState<TriageUndo[]>([]);
  const [subreddits, setSubreddits] = useState<string[]>(DEFAULT_SUBREDDITS);

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
          fetch("/api/quakes"),
          fetch(`/api/flights${near ? `?${near}` : ""}`),
          fetch(`/api/weather${near ? `?${near}` : ""}`),
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
      person,
    });
  }, [cross, desk, layer, origin, person, place, query, range, ransomware, riskFilter, stack, topic, vendor]);

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
      if (desk === "weather" && !matchesLane(item, "weather") && !itemHasTopic(item, "weather")) {
        return false;
      }
      if (desk === "documents" && !isDocumentItem(item)) return false;
      if (topic && !itemHasTopic(item, topic)) return false;
      if (place && !itemHasPlace(item, place)) return false;
      if (person && !itemHasPerson(item, person, source)) return false;
      if (triage.hidden.includes(itemKey(item.id))) return false;
      const mined = mineItem(item);
      if (ransomware && !mined.ransomware) return false;
      if (vendor && !itemHasVendor(item, vendor)) return false;
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
  }, [byId, desk, layer, origin, person, place, query, rangedItems, ransomware, topic, triage.hidden, vendor]);

  const stories = useMemo(() => {
    const clustered = clusterItems(items);
    return (cross ? clustered.filter((s) => s.sourceIds.length > 1) : clustered).filter(
      (story) => !triage.hidden.includes(`story:${story.id}`),
    );
  }, [cross, items, triage.hidden]);

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
    try {
      setState(await json<MonitorState>("/api/refresh", { method: "POST" }));
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
    setDesk(next.desk);
    setQuery(next.q);
    setTopic(next.topic);
    setPlace(next.place);
    setRange(next.range);
    setCross(next.cross);
    setStack(next.stack);
    setRiskFilter(next.risk);
    setVendor(next.vendor);
    setRansomware(next.ransomware);
    setLayer(next.layer);
    setOrigin(next.origin);
    setPerson(next.person);
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
      const res = await fetch(`/api/flights${qs}`);
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
      const res = await fetch(`/api/weather${qs}`);
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
          fetch(`/api/flights${qs ? `?${qs}` : ""}`),
          fetch(`/api/weather${qs ? `?${qs}` : ""}`),
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
      const res = await fetch(`/api/aircraft?icao24=${encodeURIComponent(flight.icao24)}`);
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
    if (desk === "home" || desk === "sources" || desk === "pulse") setDesk("scan");
  }

  function focusCve(cve: string) {
    setQuery(cve);
    const hit = state.kev.find((entry) => entry.cveId === cve);
    if (hit) openReader(kevStory(hit, rangedItems));
  }

  function toggleTopic(name: string) {
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
    if (desk === "home" || desk === "sources" || desk === "pulse") setDesk("scan");
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
    desk !== "patch" &&
    desk !== "sources" &&
    desk !== "home" &&
    desk !== "flights";

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
    person,
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
      ...(desk === "flights" || desk === "home"
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

  function changeDesk(next: Desk) {
    const custom = findUserDesk(next, customDesks);
    if (custom) applyFilters(custom.filters);
    else setDesk(next);
    if (next === "flights") void loadFlights();
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
          pulse: items.length,
          weather: rangedItems.filter((item) => matchesLane(item, "weather") || itemHasTopic(item, "weather")).length,
          people: peopleCatalog.length,
          documents: documentsFromItems(rangedItems).length,
          flights: flights.length,
          advisories: advisoryCount,
          patch: p0,
          sources: enabled.length,
        }}
        customDesks={customDesks}
        onCreateDesk={() => setDeskEditorOpen(true)}
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
          setPerson(null);
          setRiskFilter("p0");
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col bg-slate-50">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3 px-3 py-2">
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
                  desk === "patch" ? "CVE, vendor, product" : "Filter stories, CVE, vendor  /"
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
            <ThemeToggle />
            <RedditButton
              busy={busy}
              onListChange={setSubreddits}
              onLoad={(subs) => loadReddit(subs)}
            />
            <OptionsButton
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
            {desk === "patch"
              ? `${kev.length} in your stack · ${p0} patch now · ${ransomwareCount} ransomware`
              : desk === "sources"
                ? `${enabled.length} layers · cache ${state.cache.entries} bodies`
                : desk === "home"
                  ? topic
                    ? `Filtered to ${topic}`
                    : "Weather · quakes · war · unrest · click a topic to filter"
                : desk === "flights"
                  ? homeCity(homePlace)
                    ? `${flights.length} airborne within 100 km of ${homeCity(homePlace)?.name}`
                    : `${flights.length} airborne tracks (world sample)`
                  : desk === "people"
                    ? `${people.length} people on the board`
                    : desk === "documents"
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
            {desk === "patch" ? (
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
            ) : desk !== "sources" ? (
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
                {(desk === "home" ? catalogTopics : topics).slice(0, 10).map(([name, count]) => {
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
                  .filter(([name]) => isCountry(name))
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
              </>
            ) : (
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
            ) : desk === "patch" ? (
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
            ) : desk === "home" ? (
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
              />
            ) : desk === "flights" ? (
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
            ) : desk === "people" ? (
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
            ) : desk === "documents" ? (
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
                    onOpen={() => focusSource(source.id)}
                  />
                ))}
              </div>
            ) : (
              <div className={`board p-2 ${compact ? "board-compact" : ""}`}>
                {desk === "weather" && weatherEvents.length > 0 ? (
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
                {desk !== "scan" ? (
                  <>
                    <HealthCard value={stats.health} fresh={stats.fresh} total={enabled.length} />
                    <PulseCard title="Volume" points={stats.volume} />
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
                {desk === "scan"
                  ? items.map((item) => (
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
                  : desk === "pulse"
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
                    : stories.map((story) => (
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
            )}
          </main>

          {openStory ? (
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
            />
          ) : desk === "flights" && selectedFlight ? (
            <AircraftPane
              flight={selectedFlight}
              profile={aircraft}
              onClose={() => {
                setSelectedFlight(null);
                setAircraft(null);
              }}
            />
          ) : desk !== "flights" && place ? (
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
          ) : desk !== "flights" && openSourceId && byId.get(openSourceId) ? (
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

      <DeskEditor
        open={deskEditorOpen}
        onOpenChange={setDeskEditorOpen}
        current={currentFilters}
        onCreate={(label) => {
          const next = createUserDesk(label, currentFilters, customDesks);
          setCustomDesks(next);
          if (next[0]) applyFilters(next[0].filters);
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
