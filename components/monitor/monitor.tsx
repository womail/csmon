"use client";

import dynamic from "next/dynamic";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Layers, ChevronDown, ChevronRight, Undo2 } from "lucide-react";
import { CardContextMenu, type CardMenuAction } from "@/components/monitor/card-context-menu";
import { MonitorToolbar } from "@/components/monitor/monitor-toolbar";
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
import { CommandPalette } from "@/components/monitor/command-palette";
import { QueryBuilderButton } from "@/components/monitor/query-builder";
import { WatchButton } from "@/components/monitor/watch-panel";
import { EntityDesk, HomeDashboard } from "@/components/monitor/dashboard";
import { PlacePane } from "@/components/monitor/place-pane";
import { SourcePane } from "@/components/monitor/source-pane";
import { placeMarkers } from "@/components/monitor/map";

const SituationMap = dynamic(
  () => import("@/components/monitor/situation-map").then((mod) => ({ default: mod.SituationMap })),
  { ssr: false, loading: () => null },
);
import { DeskRail, DeskTabs } from "@/components/monitor/nav";
import { GdeltButton } from "@/components/monitor/gdelt-panel";
import { RedditButton } from "@/components/monitor/reddit-panel";
import { RedditRssBanner } from "@/components/monitor/reddit-rss-banner";
import { DismissFilterChip, ToggleFilterChip } from "@/components/monitor/filter-chip";
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
  refreshStory,
  situationLine,
  storiesFromPool,
  storyContaining,
  type Story,
} from "@/lib/cluster";
import { copyCardLink } from "@/lib/card-link";
import { tagStyle } from "@/lib/colors";
import { documentsFromItems, isDocumentItem } from "@/lib/documents";
import type { AircraftProfile, Flight } from "@/lib/flights";
import { homeCity, type MapMarker } from "@/lib/geo";
import { matchesStack, type KevEntry, type PatchRisk } from "@/lib/kev";
import { matchesLane, type SituationLane } from "@/lib/lanes";
import { kevForStory, itemsForCve, relatedStories, similarStories } from "@/lib/link";
import { isAdvisoryItem, itemHasVendor, matchVendorName, mineItem, vendorFamily } from "@/lib/mine";
import { withItemLimitQuery } from "@/lib/board-limit";
import {
  groupItemsByTag,
  groupItemsByTopic,
  loadBoardSort,
  saveBoardSort,
  sortItems,
  sortStories,
  type BoardSort,
} from "@/lib/board-sort";
import { applyTopicOverride, loadItemTopicOverrides, saveItemTopicOverride } from "@/lib/item-overrides";
import { loadOptions, saveOptions } from "@/lib/options";
import type { AcledProfile } from "@/lib/acled";
import {
  DEFAULT_GDELT_QUERIES,
  loadGdeltQueries,
  mergeGdeltFromSubredditSuggestions,
  saveGdeltQueries,
  type GdeltQuery,
} from "@/lib/gdelt";
import {
  DEFAULT_SUBREDDITS,
  gdeltSuggestionsFromSubreddits,
  isRedditRssSunset,
  loadSubreddits,
  REDDIT_RSS_SUNSET_LABEL,
} from "@/lib/reddit";
import { applyPalette } from "@/lib/theme";
import { shortSourceName } from "@/lib/source-label";
import { itemHasPerson, peopleFromItems } from "@/lib/people";
import { isCountry, isKnownPlace, itemHasPlace, PINNED_PLACES, resolvePlace } from "@/lib/places";
import {
  emptyQuery,
  hasQuery,
  itemMatchesQuery,
  parseQueryLine,
  summarizeQuery,
  type QueryTree,
} from "@/lib/query-builder";
import { COMMAND_DESKS, isTypingTarget } from "@/lib/hotkeys";
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
import type { Desk, DiscoveredSource, Item, MonitorState, OriginReason, Platform, TimeRange, Watchlist } from "@/lib/types";
import { isBuiltinDesk } from "@/lib/types";
import type { IntelPack } from "@/lib/intel-feeds";
import {
  addStoryToReport,
  clampReaderWidth,
  createReport,
  hydrateReports,
  loadActiveReportId,
  loadReaderWidth,
  loadReports,
  openReports,
  READER_WIDTH_DEFAULT,
  saveActiveReportId,
  saveReaderWidth,
  snapshotStory,
  type Report,
} from "@/lib/reports";
import type { WeatherEvent } from "@/lib/weather";
import {
  clearDisplayCollection,
  loadDisplayCollection,
  saveDisplayCollection,
  type DisplayCollection,
} from "@/lib/display-collection";
import {
  displayOnlyIdsFromStory,
  filtersFromItem,
  guessDeskTitleFromItem,
} from "@/lib/desk-from-item";
import { itemInTimeRange } from "@/lib/item-freshness";
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
const FlightDesk = dynamic(
  () => import("@/components/monitor/flights").then((mod) => ({ default: mod.FlightDesk })),
  { ssr: false, loading: () => <div className="geo-map-skeleton min-h-[420px]">Loading flights…</div> },
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
const STACK_TOPIC_VALUES = new Set(["ai", "sports", "reddit"]);
const STACK_VENDOR_VALUES = new Set(
  STACK_CHIPS.filter((chip) => chip.kind === "vendor").map((chip) => chip.value),
);
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

function statePath(path: string, limit: number, q?: string) {
  const base = withItemLimitQuery(path, limit);
  const text = q?.trim();
  if (!text) return base;
  return `${base}${base.includes("?") ? "&" : "?"}q=${encodeURIComponent(text)}`;
}

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
    const ts = item.publishedAt;
    if (!ts) continue;
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
    watches: initial.watches ?? [],
  });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<"palette" | "help">("palette");
  const [focusIndex, setFocusIndex] = useState(0);
  const [query, setQuery] = useState(seed.q);
  const deferredQuery = useDeferredValue(query);
  const [boardCap, setBoardCap] = useState(BOARD_PAGE);
  const [topic, setTopic] = useState<string | null>(seed.topic);
  const [filterTopics, setFilterTopics] = useState<string[]>(seed.topics ?? []);
  const [filterTags, setFilterTags] = useState<string[]>(seed.tags ?? []);
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
  const [boardItemLimit, setBoardItemLimit] = useState(() => loadOptions().boardItemLimit);
  const [triage, setTriage] = useState<TriageState>({ hidden: [], read: [] });
  const [triageUndo, setTriageUndo] = useState<TriageUndo[]>([]);
  const [subreddits, setSubreddits] = useState<string[]>(DEFAULT_SUBREDDITS);
  const [redditDialogOpen, setRedditDialogOpen] = useState(false);
  const [gdeltQueries, setGdeltQueries] = useState<GdeltQuery[]>(DEFAULT_GDELT_QUERIES);
  const [reports, setReports] = useState<Report[]>([]);
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const [readerWidth, setReaderWidth] = useState(READER_WIDTH_DEFAULT);
  const [boardSort, setBoardSort] = useState<BoardSort>("newest");
  const [topicOverrides, setTopicOverrides] = useState<Record<string, { topics: string[]; updatedAt: number }>>(
    {},
  );
  const [cardMenu, setCardMenu] = useState<{
    item: Item;
    story: Story | null;
    x: number;
    y: number;
  } | null>(null);
  const [displayCollection, setDisplayCollection] = useState<DisplayCollection | null>(null);
  const [focusItem, setFocusItem] = useState<number | null>(seed.focusItem ?? null);
  const [linkCopied, setLinkCopied] = useState<number | null>(null);
  const focusItemHandled = useRef<number | null>(null);
  const [autoRefreshMinutes, setAutoRefreshMinutes] = useState(0);

  function setState(next: MonitorState) {
    setStateRaw({
      ...next,
      kev: next.kev ?? [],
      hints: next.hints ?? [],
      cache: next.cache ?? { entries: 0, bytes: 0 },
      watches: next.watches ?? [],
    });
  }

  useEffect(() => {
    let cancelled = false;
    setCustomDesks(loadUserDesks());
    setDisplayCollection(loadDisplayCollection());
    const opts = loadOptions();
    applyPalette(opts.palette);
    setCompact(opts.compact);
    setHomeLanguage(opts.homeLanguage);
    setAutoTranslate(opts.autoTranslate);
    setHomePlace(opts.homePlace || "Dublin");
    setTriage(loadTriage());
    setTriageUndo(loadTriageUndo());
    setSubreddits(loadSubreddits());
    setGdeltQueries(loadGdeltQueries());
    setBoardSort(loadBoardSort());
    setTopicOverrides(loadItemTopicOverrides());
    setAutoRefreshMinutes(opts.autoRefreshMinutes);
    setReports(loadReports());
    void hydrateReports().then((rows) => {
      if (!cancelled) setReports(rows);
    });
    setOpenReportId(loadActiveReportId());
    setReaderWidth(loadReaderWidth());
    setFollowOpen(window.localStorage.getItem("csmon.follow-open") !== "0");
    setBoardItemLimit(opts.boardItemLimit);
    if (!seed.stack) {
      setStack(opts.stack || window.localStorage.getItem("csmon.stack") || "");
    }
    const params = new URLSearchParams(window.location.search);
    if (!params.get("desk") && opts.defaultDesk !== "home") setDesk(opts.defaultDesk);
    if (!params.get("range") && opts.defaultRange !== "24h") setRange(opts.defaultRange);
    const city = homeCity(opts.homePlace || "Dublin");
    const near = city ? `lat=${city.lat}&lng=${city.lng}&km=100&place=${encodeURIComponent(city.name)}` : "";
    (async () => {
      try {
        const empty = initial.sources.filter((source) => source.enabled).length === 0;
        if (opts.autoLoadSecurity && empty) {
          const next = await json<MonitorState>(statePath("/api/intel", boardItemLimit), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pack: "security", enable: true }),
          });
          if (!cancelled) setState(next);
        }
        if (opts.autoLoadHazards && empty) {
          const next = await json<MonitorState>(statePath("/api/intel", boardItemLimit), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pack: "hazard", enable: true }),
          });
          if (!cancelled) setState(next);
        }
        if (opts.autoLoadKev && !(initial.kev?.length)) {
          const next = await json<MonitorState>(statePath("/api/kev", boardItemLimit), {
            method: "POST",
          });
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
      topics: filterTopics,
      place,
      tags: filterTags,
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
      focusItem,
    });
  }, [
    cross,
    desk,
    filterTags,
    filterTopics,
    focusItem,
    layer,
    origin,
    person,
    place,
    platform,
    qb,
    query,
    range,
    ransomware,
    rising,
    riskFilter,
    stack,
    topic,
    vendor,
  ]);

  const enabled = state.sources.filter((s) => s.enabled);
  const byId = useMemo(
    () => new Map(state.sources.map((s) => [s.id, s])),
    [state.sources],
  );

  const rangedItems = useMemo(() => {
    return state.items.filter((item) => {
      const source = byId.get(item.sourceId);
      if (!source?.enabled) return false;
      return itemInTimeRange(item, range);
    });
  }, [byId, range, state.items]);

  const boardItems = useMemo(
    () => rangedItems.map((item) => applyTopicOverride(item, topicOverrides)),
    [rangedItems, topicOverrides],
  );

  const poolStories = useMemo(() => clusterItems(boardItems), [boardItems]);

  const openStoryMeta = openStory
    ? `${openStory.id}|${openStory.topics.join()}|${openStory.tags.join()}|${openStory.items
        .map((row) => `${row.id}:${row.topics.join(".")}:${row.tags.join(".")}`)
        .join(";")}`
    : "";

  useEffect(() => {
    if (!openStory) return;
    const next = refreshStory(openStory, boardItems, poolStories);
    if (!next) {
      setOpenStory(null);
      return;
    }
    const nextMeta = `${next.id}|${next.topics.join()}|${next.tags.join()}|${next.items
      .map((row) => `${row.id}:${row.topics.join(".")}:${row.tags.join(".")}`)
      .join(";")}`;
    if (nextMeta !== openStoryMeta) setOpenStory(next);
  }, [boardItems, openStory, openStoryMeta, poolStories]);

  useEffect(() => {
    if (!focusItem || focusItemHandled.current === focusItem) return;
    const raw = state.items.find((row) => row.id === focusItem);
    if (!raw) return;
    const item = applyTopicOverride(raw, topicOverrides);
    focusItemHandled.current = focusItem;
    const story = storyContaining(item, poolStories) ?? itemAsStory(item);
    setOpenStory(story);
    window.requestAnimationFrame(() =>
      document.getElementById(`card-item-${focusItem}`)?.scrollIntoView({ block: "nearest" }),
    );
  }, [focusItem, poolStories, state.items, topicOverrides]);
  const activeCustom = findUserDesk(desk, customDesks);
  const viewDesk: Desk = activeCustom?.view ?? (isBuiltinDesk(desk) ? desk : "brief");

  useEffect(() => {
    setBoardCap(BOARD_PAGE);
  }, [
    boardSort,
    deferredQuery,
    displayCollection,
    filterTags,
    filterTopics,
    layer,
    origin,
    person,
    place,
    platform,
    qb,
    range,
    rising,
    topic,
    vendor,
    viewDesk,
  ]);

  useEffect(() => {
    if (!autoRefreshMinutes) return;
    const ms = autoRefreshMinutes * 60_000;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refresh({ skipGdelt: true, skipReddit: true, skipAcled: true });
    }, ms);
    return () => window.clearInterval(id);
  }, [autoRefreshMinutes, boardItemLimit]);

  const baseItems = useMemo(() => {
    const parsedLine = parseQueryLine(deferredQuery);
    const q = parsedLine.text.trim().toLowerCase();
    const needMine = ransomware || Boolean(q);
    return boardItems.filter((item) => {
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
      if (filterTopics.length && !filterTopics.some((name) => itemHasTopic(item, name))) return false;
      if (
        filterTags.length &&
        !filterTags.some((name) => item.tags.includes(name) || item.topics.includes(name))
      ) {
        return false;
      }
      if (displayCollection?.itemIds.length && !displayCollection.itemIds.includes(item.id)) return false;
      if (place && !itemHasPlace(item, place)) return false;
      if (person && !itemHasPerson(item, person, source)) return false;
      if (triage.hidden.includes(itemKey(item.id))) return false;
      if (vendor && !itemHasVendor(item, vendor)) return false;
      if (needMine) {
        const mined = mineItem(item);
        if (ransomware && !mined.ransomware) return false;
        if (
          q &&
          !`${item.title} ${item.summary ?? ""} ${item.extractText ?? ""} ${source?.name ?? ""} ${item.locations.join(" ")} ${mined.cves.join(" ")} ${item.iocs?.join(" ") ?? ""}`
            .toLowerCase()
            .includes(q)
        ) {
          return false;
        }
      }
      if (!itemMatchesQuery(item, parsedLine.tree, source)) return false;
      if (!itemMatchesQuery(item, qb, source)) return false;
      return true;
    });
  }, [
    boardItems,
    byId,
    deferredQuery,
    displayCollection,
    filterTags,
    filterTopics,
    layer,
    origin,
    person,
    place,
    platform,
    qb,
    ransomware,
    topic,
    triage.hidden,
    vendor,
    viewDesk,
  ]);

  const trends = useMemo(() => buildTrends(baseItems, range, byId), [baseItems, byId, range]);
  const hotKeys = useMemo(() => risingKeySet(trends), [trends]);
  const cveHits = useMemo(() => minedCves(baseItems).slice(0, 6), [baseItems]);

  const items = useMemo(() => {
    const filtered = !rising
      ? baseItems
      : baseItems.filter((item) => itemMatchesRising(item, hotKeys, byId.get(item.sourceId)));
    return sortItems(filtered, boardSort);
  }, [baseItems, boardSort, byId, hotKeys, rising]);

  const stories = useMemo(() => {
    const allowed = new Set(items.map((item) => item.id));
    return sortStories(storiesFromPool(poolStories, allowed, cross, triage.hidden), boardSort);
  }, [boardSort, cross, items, poolStories, triage.hidden]);

  const boardList = useMemo(() => {
    if (viewDesk === "scan") return items.slice(0, boardCap).map((item) => ({ kind: "item" as const, item }));
    const rows = viewDesk === "pulse" ? stories.slice(0, 12) : stories.slice(0, boardCap);
    return rows.map((story) => ({ kind: "story" as const, story }));
  }, [boardCap, items, stories, viewDesk]);

  useEffect(() => {
    setFocusIndex(0);
  }, [boardList]);

  useEffect(() => {
    document.querySelector(".card-tile-focus")?.scrollIntoView({ block: "nearest" });
  }, [focusIndex]);

  const searchPulled = useRef(Boolean(seed.q.trim()));
  useEffect(() => {
    const line = deferredQuery.trim();
    if (!line && !searchPulled.current) return;
    let cancelled = false;
    void json<MonitorState>(statePath("/api/state", boardItemLimit, line || undefined))
      .then((next) => {
        if (!cancelled) {
          setState(next);
          searchPulled.current = Boolean(line);
        }
      })
      .catch(() => {
        /* keep current board */
      });
    return () => {
      cancelled = true;
    };
  }, [boardItemLimit, deferredQuery]);

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
      }>(statePath("/api/scrape", boardItemLimit), {
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
      const next = await json<MonitorState>(statePath("/api/sources", boardItemLimit), {
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
      await json<MonitorState>(statePath("/api/sources", boardItemLimit), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enabledNow ? { disable: [id] } : { enable: [id] }),
      }),
    );
  }

  async function refresh(options?: { skipGdelt?: boolean; skipReddit?: boolean; skipAcled?: boolean }) {
    setRefreshing(true);
    setError(null);
    try {
      const data = await json<MonitorState>(statePath("/api/refresh", boardItemLimit), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options ?? {}),
      });
      const { refreshWarnings, ...state } = data;
      setState(state);
      if (refreshWarnings?.failed && refreshWarnings.errors.length) {
        setError(
          refreshWarnings.ok
            ? `Some layers failed: ${refreshWarnings.errors.join(" · ")}`
            : refreshWarnings.errors.join(" · "),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  function importSubredditsToGdelt(subs: string[]) {
    const suggestions = gdeltSuggestionsFromSubreddits(subs);
    const merged = mergeGdeltFromSubredditSuggestions(loadGdeltQueries(), suggestions);
    saveGdeltQueries(merged);
    setGdeltQueries(merged);
    setError("GDELT query drafts added from your subreddit list. Open GDELT → Load GDELT when ready.");
  }

  async function loadReddit(subs = subreddits) {
    const opts = loadOptions();
    const hasOAuth = Boolean(opts.redditOAuthClientId && opts.redditOAuthClientSecret);
    if (isRedditRssSunset() && !hasOAuth) {
      importSubredditsToGdelt(subs);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setState(
        await json<MonitorState>(statePath("/api/reddit", boardItemLimit), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subs,
            enable: true,
            oauthClientId: opts.redditOAuthClientId,
            oauthClientSecret: opts.redditOAuthClientSecret,
          }),
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

  async function loadAcled(profiles: AcledProfile[]) {
    setBusy(true);
    setError(null);
    try {
      const data = await json<MonitorState>(statePath("/api/acled", boardItemLimit), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profiles }),
      });
      setState(data);
      setDesk("home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ACLED load failed");
    } finally {
      setBusy(false);
    }
  }

  function cardAnchorId(itemId: number) {
    return `card-item-${itemId}`;
  }

  async function copyCardLinkFor(item: Item) {
    try {
      await copyCardLink({ ...filtersSnapshot(), focusItem: item.id }, item.id);
      setFocusItem(item.id);
      setLinkCopied(item.id);
      window.setTimeout(() => setLinkCopied((id) => (id === item.id ? null : id)), 2500);
    } catch {
      setError("Could not copy link");
    }
  }

  function openCardMenu(item: Item, event: ReactMouseEvent, story: Story | null = null) {
    event.preventDefault();
    setCardMenu({
      item,
      story,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function filtersSnapshot(): BoardFilters {
    return normalizeBoardFilters({
      desk,
      q: query,
      topic,
      topics: filterTopics,
      place,
      tags: filterTags,
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
      focusItem,
    });
  }

  async function handleCardMenuAction(action: CardMenuAction) {
    if (action.kind === "close") {
      setCardMenu(null);
      return;
    }
    if (!cardMenu) return;
    const { item, story } = cardMenu;
    setCardMenu(null);

    if (action.kind === "reclassify") {
      await reclassifyItemTopics(item.id, action.topics);
      return;
    }
    if (action.kind === "display-only") {
      const itemIds = story ? displayOnlyIdsFromStory(story) : [item.id];
      const label = (story?.title ?? item.title).trim().slice(0, 32) || guessDeskTitleFromItem(item);
      const next: DisplayCollection = { itemIds, label, updatedAt: Date.now() };
      saveDisplayCollection(next);
      setDisplayCollection(next);
      return;
    }
    if (action.kind === "add-display") {
      const addIds = story ? displayOnlyIdsFromStory(story) : [item.id];
      const prev = displayCollection ?? { itemIds: [], label: "Pinned cards", updatedAt: Date.now() };
      const itemIds = [...new Set([...prev.itemIds, ...addIds])];
      const next: DisplayCollection = { ...prev, itemIds, updatedAt: Date.now() };
      saveDisplayCollection(next);
      setDisplayCollection(next);
      return;
    }
    if (action.kind === "save-desk") {
      const filters = filtersFromItem(item, filtersSnapshot());
      const label = guessDeskTitleFromItem(item);
      const next = createUserDesk(label, filters, customDesks, "brief");
      setCustomDesks(next);
      const created = next[0];
      if (created) applyFilters({ ...created.filters, desk: created.id });
      return;
    }
    if (action.kind === "copy-link") {
      await copyCardLinkFor(item);
    }
  }

  async function reclassifyItemTopics(itemId: number, topics: string[]) {
    const cleaned = [...new Set(topics.map((t) => t.trim().toLowerCase()).filter(Boolean))];
    if (!cleaned.length) {
      setError("Keep at least one topic on the card.");
      return;
    }
    try {
      const data = await json<MonitorState>(statePath("/api/items/reclassify", boardItemLimit), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, topics: cleaned }),
      });
      setState(data);
      const row = data.items.find((entry) => entry.id === itemId);
      const overrides = saveItemTopicOverride(itemId, cleaned, row?.tags);
      setTopicOverrides(overrides);
      setOpenStory((prev) => {
        if (!prev) return prev;
        const items = data.items.map((entry) => applyTopicOverride(entry, overrides));
        return refreshStory(prev, items, clusterItems(items));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reclassify failed");
    }
  }

  async function applyMyBriefing(profile: import("@/lib/briefing-profile").MyBriefingProfile) {
    applyFilters({
      desk: profile.desk,
      q: profile.q ?? "",
      topic: profile.topic,
      topics: [],
      place: profile.place,
      tags: [],
      range: profile.range,
      cross: profile.cross,
      rising: profile.rising,
      stack,
      risk: riskFilter,
      vendor: null,
      ransomware,
      layer: profile.layer,
      origin: null,
      platform: null,
      person: null,
      qb,
      focusItem: null,
    });
    const keys = new Set(profile.enabledSourceKeys);
    if (!keys.size) return;
    const enable = state.sources.filter((s) => keys.has(s.key)).map((s) => s.id);
    const disable = state.sources.filter((s) => s.enabled && !keys.has(s.key)).map((s) => s.id);
    if (!enable.length && !disable.length) return;
    try {
      setState(
        await json<MonitorState>(statePath("/api/sources", boardItemLimit), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enable, disable }),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore briefing layers");
    }
  }

  function clickItemTag(item: Item, tag: string, event: ReactMouseEvent) {
    if (event.shiftKey) {
      void reclassifyItemTopics(
        item.id,
        item.topics.filter((topic) => topic !== tag),
      );
      return;
    }
    clickChip(tag);
  }

  async function loadGdelt(queries = gdeltQueries) {
    setBusy(true);
    setError(null);
    try {
      const data = await json<MonitorState>(statePath("/api/gdelt", boardItemLimit), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queries }),
      });
      const { gdeltRefresh, ...state } = data;
      setState(state);
      setGdeltQueries(queries);
      setDesk("home");
      if (gdeltRefresh?.failed && gdeltRefresh.errors.length) {
        setError(
          gdeltRefresh.ok
            ? `Some GDELT queries did not load: ${gdeltRefresh.errors.join(" · ")}`
            : gdeltRefresh.errors.join(" · "),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "GDELT feed failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadIntel(pack: IntelPack) {
    setBusy(true);
    try {
      setState(
        await json<MonitorState>(statePath("/api/intel", boardItemLimit), {
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
    setFilterTopics(filters.topics);
    setFilterTags(filters.tags);
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
    setFocusItem(filters.focusItem ?? null);
  }

  function clearBoardFilters() {
    setQuery("");
    setTopic(null);
    setFilterTopics([]);
    setFilterTags([]);
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
    setOpenSourceId(null);
    setFocusItem(null);
    focusItemHandled.current = null;
  }

  const boardFiltersActive =
    Boolean(layer) ||
    Boolean(platform) ||
    rising ||
    hasQuery(qb) ||
    Boolean(place) ||
    Boolean(person) ||
    Boolean(vendor) ||
    Boolean(topic) ||
    filterTopics.length > 0 ||
    filterTags.length > 0 ||
    Boolean(displayCollection?.itemIds.length) ||
    Boolean(origin) ||
    cross ||
    Boolean(query.trim()) ||
    ransomware ||
    (viewDesk === "patch" && riskFilter !== "all");

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
      setState(await json<MonitorState>(statePath("/api/kev", boardItemLimit), { method: "POST" }));
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
        await json<MonitorState>(statePath("/api/explore", boardItemLimit), {
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
    setFocusItem(next.items[0]?.id ?? null);
  }

  function closeReader() {
    setOpenStory(null);
    setFocusItem(null);
    focusItemHandled.current = null;
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

  function focusedStory(): Story | null {
    if (openStory) return openStory;
    const row = boardList[focusIndex];
    if (!row) return null;
    if (row.kind === "story") return row.story;
    return itemAsStory(row.item);
  }

  function reportFocused() {
    const story = focusedStory();
    if (!story) return;
    const snap = snapshotStory(story, byId);
    const live = openReports(reports);
    const target = live.find((row) => row.id === openReportId) ?? live[0];
    if (target) {
      setReports(addStoryToReport(target.id, snap, reports));
      setOpenReportId(target.id);
      return;
    }
    const next = createReport(story.title, snap, reports);
    setReports(next.rows);
    setOpenReportId(next.report.id);
  }

  function hideFocused() {
    const story = focusedStory();
    if (!story) return;
    hideStory(story);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const typing = isTypingTarget(event.target);
      if (event.key === "Escape") {
        if (paletteOpen) {
          setPaletteOpen(false);
          return;
        }
        if (trail.length) backReader();
        else closeReader();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteMode("palette");
        setPaletteOpen((current) => !current);
        return;
      }
      if (paletteOpen) return;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        document.getElementById("board-search")?.focus();
        return;
      }
      if (event.key === "?" && !typing) {
        event.preventDefault();
        setPaletteMode("help");
        setPaletteOpen(true);
        return;
      }
      if (typing) return;
      if (event.key >= "1" && event.key <= "9") {
        const next = COMMAND_DESKS[Number(event.key) - 1];
        if (next) setDesk(next);
        return;
      }
      if (event.key === "j") {
        event.preventDefault();
        setFocusIndex((current) => Math.min(boardList.length - 1, current + 1));
        return;
      }
      if (event.key === "k") {
        event.preventDefault();
        setFocusIndex((current) => Math.max(0, current - 1));
        return;
      }
      if (event.key === "Enter") {
        const story = focusedStory();
        if (story) {
          event.preventDefault();
          openReader(story);
        }
        return;
      }
      if (event.key === "h") {
        event.preventDefault();
        hideFocused();
        return;
      }
      if (event.key === "u") {
        event.preventDefault();
        applyTriage(undoTriage(triage, triageUndo));
        return;
      }
      if (event.key === "r") {
        event.preventDefault();
        reportFocused();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [boardList, focusIndex, openReportId, openStory, paletteOpen, reports, trail.length, triage, triageUndo]);

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
    topics: filterTopics,
    place,
    tags: filterTags,
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
    focusItem,
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
        onClearFilters={clearBoardFilters}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50">
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm">
          <RedditRssBanner onMigrate={() => setRedditDialogOpen(true)} />
          <MonitorToolbar
            viewDesk={viewDesk}
            query={query}
            onQueryChange={setQuery}
            desk={desk}
            onDeskChange={changeDesk}
            customDesks={customDesks}
            range={range}
            onRangeChange={setRange}
            ranges={RANGES}
            boardSort={boardSort}
            onBoardSortChange={(sort) => {
              setBoardSort(sort);
              saveBoardSort(sort);
            }}
            refreshing={refreshing}
            busy={busy}
            onRefresh={() => void refresh()}
            onLoadKev={() => void loadKev()}
            onHome={goHome}
            watchLine={[query.trim(), summarizeQuery(qb)].filter(Boolean).join(" ")}
            onTune={() => {
              setEditingDesk(findUserDesk(desk, customDesks));
              setDeskEditorOpen(true);
            }}
            currentFilters={currentFilters}
            onApplyFilters={applyFilters}
            onApplyBriefing={applyMyBriefing}
            enabledSourceKeys={enabled.map((s) => s.key)}
            qb={qb}
            onQbChange={setQb}
            watches={state.watches ?? []}
            onWatchesChange={(watches) => setStateRaw((current) => ({ ...current, watches }))}
            onOpenWatch={(watch) => {
              setQuery(watch.query);
              if (watch.desk) setDesk(watch.desk as Desk);
              void apiFetch("/api/watchlists", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ack: watch.id }),
              })
                .then((res) => res.json())
                .then((data: { watches?: Watchlist[] }) => {
                  if (data.watches) setStateRaw((current) => ({ ...current, watches: data.watches ?? [] }));
                })
                .catch(() => {
                  /* ignore */
                });
            }}
            subreddits={subreddits}
            redditOpen={redditDialogOpen}
            onRedditOpenChange={setRedditDialogOpen}
            onSubredditsChange={setSubreddits}
            onLoadReddit={(subs) => void loadReddit(subs)}
            onImportGdelt={importSubredditsToGdelt}
            onGdeltListChange={setGdeltQueries}
            onLoadGdelt={(queries) => void loadGdelt(queries)}
            onAcledListChange={() => {
              /* profiles saved in dialog */
            }}
            onLoadAcled={(profiles) => void loadAcled(profiles)}
            onSourcesApplied={(next) => setState(next)}
            onOptionsApply={(options) => {
              setCompact(options.compact);
              if (options.stack) setStack(options.stack);
              setDesk(options.defaultDesk);
              setRange(options.defaultRange);
              setHomeLanguage(options.homeLanguage);
              setAutoTranslate(options.autoTranslate);
              changeHomePlace(options.homePlace || "");
              setBoardItemLimit(options.boardItemLimit);
              setAutoRefreshMinutes(options.autoRefreshMinutes);
              void json<MonitorState>(statePath("/api/state", options.boardItemLimit)).then(setState);
            }}
            onAddRss={() => setScrapeOpen(true)}
          />
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
            {boardFiltersActive ? (
              <DismissFilterChip
                label="Clear all filters"
                tip="Remove every active filter on this desk"
                onDismiss={clearBoardFilters}
                background="#f1f5f9"
                color="#334155"
              />
            ) : null}
            {query.trim() ? (
              <DismissFilterChip
                label={`Search: ${query.trim().slice(0, 32)}${query.trim().length > 32 ? "…" : ""}`}
                onDismiss={() => setQuery("")}
                background="#475569"
              />
            ) : null}
            {(state.watches ?? []).some((watch) => watch.newHits > 0) ? (
              <DismissFilterChip
                label={`Watch hits: ${(state.watches ?? []).reduce((sum, watch) => sum + watch.newHits, 0)}`}
                tip="Open the first watch with new matches"
                onDismiss={() => {
                  const watch = (state.watches ?? []).find((row) => row.newHits > 0);
                  if (!watch) return;
                  setQuery(watch.query);
                  if (watch.desk) setDesk(watch.desk as Desk);
                }}
                background="#c2410c"
              />
            ) : null}
            {topic ? (
              <DismissFilterChip label={`Topic: ${topic}`} onDismiss={() => setTopic(null)} background="#0f172a" />
            ) : null}
            {filterTopics.map((name) => (
              <DismissFilterChip
                key={`ft-${name}`}
                label={`Topic: ${name}`}
                onDismiss={() => setFilterTopics((rows) => rows.filter((row) => row !== name))}
                background="#0f172a"
              />
            ))}
            {filterTags.map((name) => (
              <DismissFilterChip
                key={`fg-${name}`}
                label={`Tag: ${name}`}
                onDismiss={() => setFilterTags((rows) => rows.filter((row) => row !== name))}
                background="#1e3a8a"
              />
            ))}
            {displayCollection?.itemIds.length ? (
              <DismissFilterChip
                label={`Display only: ${displayCollection.label} (${displayCollection.itemIds.length})`}
                tip="Show only pinned cards from the context menu"
                onDismiss={() => {
                  clearDisplayCollection();
                  setDisplayCollection(null);
                }}
                background="#0369a1"
              />
            ) : null}
            {layer ? (
              <DismissFilterChip
                label={shortSourceName(byId.get(layer)?.name ?? "layer")}
                onDismiss={() => {
                  setLayer(null);
                  setOpenSourceId(null);
                }}
              />
            ) : null}
            {platform ? (
              <DismissFilterChip label={platform} onDismiss={() => setPlatform(null)} />
            ) : null}
            {origin ? (
              <DismissFilterChip label={`origin: ${origin}`} onDismiss={() => setOrigin(null)} />
            ) : null}
            {cross ? (
              <DismissFilterChip label="2+ sources" onDismiss={() => setCross(false)} />
            ) : null}
            {rising ? (
              <DismissFilterChip
                label="rising"
                onDismiss={() => setRising(false)}
                background="#15803d"
              />
            ) : null}
            {ransomware ? (
              <DismissFilterChip
                label="ransomware"
                onDismiss={() => setRansomware(false)}
                background="#9f1239"
              />
            ) : null}
            {viewDesk === "patch" && riskFilter !== "all" ? (
              <DismissFilterChip
                label={RISK_LABEL[riskFilter]}
                onDismiss={() => setRiskFilter("all")}
                background="#0f172a"
              />
            ) : null}
            {hasQuery(qb) ? (
              <DismissFilterChip
                label="query builder"
                tip={summarizeQuery(qb)}
                onDismiss={() => setQb(emptyQuery())}
                background="#1d4ed8"
              />
            ) : null}
            {place ? (
              <DismissFilterChip label={place} onDismiss={() => setPlace(null)} background="#0e7490" />
            ) : null}
            {person ? (
              <DismissFilterChip label={person} onDismiss={() => setPerson(null)} background="#6d28d9" />
            ) : null}
            {vendor ? (
              <DismissFilterChip label={vendor} onDismiss={() => setVendor(null)} background="#9f1239" />
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
                {(["intel", "reddit", "gdelt", "explore", "self", "follow"] as const).map((id) => (
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
                      background: platform === "rss" ? "#334155" : "#f1f5f9",
                      color: platform === "rss" ? "#f8fafc" : "#64748b",
                    }}
                  >
                    RSS{platform === "rss" ? " ✓" : ""}
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
                    <ToggleFilterChip
                      key={chip.label}
                      label={chip.label}
                      active={active}
                      tip={active ? `Remove ${chip.label} filter` : `Filter to ${chip.label}`}
                      onToggle={() =>
                        chip.kind === "topic" ? toggleTopic(chip.value) : toggleVendor(chip.value)
                      }
                      onDismiss={() =>
                        chip.kind === "topic" ? setTopic(null) : setVendor(null)
                      }
                      activeBackground={style.fg}
                      activeColor="#fff"
                      idleBackground={style.bg}
                      idleColor={style.fg}
                    />
                  );
                })}
                {pinnedPlaceCounts.map(([name, count]) => {
                  const style = tagStyle("place");
                  const active = place === name;
                  return (
                    <ToggleFilterChip
                      key={`pin-${name}`}
                      label={`${name} ${count}`}
                      active={active}
                      tip={
                        active
                          ? `Remove ${name} filter`
                          : `Everything mentioning ${name} in title or summary`
                      }
                      onToggle={() => focusPlace(name)}
                      onDismiss={() => setPlace(null)}
                      activeBackground={style.fg}
                      activeColor="#fff"
                      idleBackground={style.bg}
                      idleColor={style.fg}
                    />
                  );
                })}
                {(viewDesk === "home" ? catalogTopics : topics)
                  .filter(([name]) => !STACK_TOPIC_VALUES.has(name))
                  .slice(0, 10)
                  .map(([name, count]) => {
                  const style = tagStyle(name);
                  const active = topic === name;
                  return (
                    <ToggleFilterChip
                      key={name}
                      label={`${name} ${count}`}
                      active={active}
                      tip={active ? `Remove ${name} filter` : `Filter this desk to ${name}`}
                      onToggle={() => toggleTopic(name)}
                      onDismiss={() => setTopic(null)}
                      activeBackground={style.fg}
                      activeColor="#fff"
                      idleBackground={style.bg}
                      idleColor={style.fg}
                    />
                  );
                })}
                {places
                  .filter(([name]) => isCountry(name) && !PINNED_PLACES.includes(name as (typeof PINNED_PLACES)[number]))
                  .slice(0, 8)
                  .map(([name, count]) => {
                    const style = tagStyle("place");
                    const active = place === name;
                    return (
                      <ToggleFilterChip
                        key={`country-${name}`}
                        label={`${name} ${count}`}
                        active={active}
                        onToggle={() => focusPlace(name)}
                        onDismiss={() => setPlace(null)}
                        activeBackground={style.fg}
                        activeColor="#fff"
                        idleBackground={style.bg}
                        idleColor={style.fg}
                      />
                    );
                  })}
                {places
                  .filter(([name]) => !isCountry(name))
                  .slice(0, 5)
                  .map(([name, count]) => {
                    const style = tagStyle("place");
                    const active = place === name;
                    return (
                      <ToggleFilterChip
                        key={name}
                        label={`${name} ${count}`}
                        active={active}
                        onToggle={() => focusPlace(name)}
                        onDismiss={() => setPlace(null)}
                        activeBackground={style.fg}
                        activeColor="#fff"
                        idleBackground={style.bg}
                        idleColor={style.fg}
                      />
                    );
                  })}
                {vendors
                  .filter(([name]) => !STACK_VENDOR_VALUES.has(name))
                  .slice(0, 6)
                  .map(([name, count]) => {
                  const active = vendor === name;
                  return (
                    <ToggleFilterChip
                      key={name}
                      label={`${name} ${count}`}
                      active={active}
                      onToggle={() => toggleVendor(name)}
                      onDismiss={() => setVendor(null)}
                      activeBackground="#9f1239"
                      activeColor="#fff"
                      idleBackground="#fee2e2"
                      idleColor="#9f1239"
                    />
                  );
                })}
                {cveHits.map(([cve, count]) => {
                  const active = query.toLowerCase() === cve.toLowerCase();
                  return (
                    <ToggleFilterChip
                      key={cve}
                      label={`${cve} ${count}`}
                      active={active}
                      tip={active ? `Clear ${cve} search` : `Search the board for ${cve}`}
                      onToggle={() => setQuery((current) => (current === cve ? "" : cve))}
                      onDismiss={() => setQuery("")}
                      activeBackground="#9f1239"
                      activeColor="#fff"
                      idleBackground="#fff7ed"
                      idleColor="#9a3412"
                    />
                  );
                })}
                {peopleCatalog.slice(0, 5).map((row) => {
                  const active = person === row.name;
                  return (
                    <ToggleFilterChip
                      key={row.name}
                      label={`${row.name} ${row.count}`}
                      active={active}
                      tip={active ? `Remove ${row.name} filter` : `Filter to ${row.name}`}
                      onToggle={() => togglePerson(row.name)}
                      onDismiss={() => setPerson(null)}
                      activeBackground="#6d28d9"
                      activeColor="#fff"
                      idleBackground="#ede9fe"
                      idleColor="#6d28d9"
                    />
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
                    label={isRedditRssSunset() ? "Migrate" : "Manage"}
                    open={redditDialogOpen}
                    onOpenChange={setRedditDialogOpen}
                    onListChange={setSubreddits}
                    onLoad={(subs) => loadReddit(subs)}
                    onImportGdelt={importSubredditsToGdelt}
                  />
                  {!isRedditRssSunset() ? (
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
                  ) : null}
                </div>
                <div className="flex w-full basis-full flex-wrap items-center gap-1">
                  <span className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                    GDELT
                  </span>
                  {gdeltQueries.filter((query) => query.enabled).map((query) => (
                    <span key={query.id} className="tag">
                      {query.name}
                    </span>
                  ))}
                  <GdeltButton
                    busy={busy}
                    label="Tune"
                    onListChange={setGdeltQueries}
                    onLoad={(queries) => loadGdelt(queries)}
                  />
                  <Tip text="Load the enabled GDELT queries">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => void loadGdelt()}
                      disabled={busy || !gdeltQueries.some((query) => query.enabled)}
                    >
                      Load GDELT
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
          <main
            className={`min-w-0 flex-1 ${viewDesk === "flights" ? "flex min-h-0 flex-col" : ""}`}
          >
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
                    {isRedditRssSunset()
                      ? `Public Reddit RSS ended ${REDDIT_RSS_SUNSET_LABEL}. Import names to GDELT keyword queries.`
                      : "One combined public RSS until 13 Nov 2026. About one request per minute."}
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
                      open={redditDialogOpen}
                      onOpenChange={setRedditDialogOpen}
                      onListChange={setSubreddits}
                      onLoad={(subs) => loadReddit(subs)}
                      onImportGdelt={importSubredditsToGdelt}
                    />
                    {!isRedditRssSunset() ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void loadReddit()}
                        disabled={busy || !subreddits.length}
                      >
                        Load Reddit
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 border-t border-slate-200/80 pt-3">
                  <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                    GDELT
                  </div>
                  <p className="mt-1 text-[12px] text-slate-500">
                    Tunable news queries. Four at a time, about one request every 5 seconds.
                  </p>
                  <div className="mt-2 flex flex-wrap justify-center gap-1">
                    {gdeltQueries.filter((query) => query.enabled).map((query) => (
                      <span key={query.id} className="tag">
                        {query.name}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    <GdeltButton
                      busy={busy}
                      onListChange={setGdeltQueries}
                      onLoad={(queries) => loadGdelt(queries)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void loadGdelt()}
                      disabled={busy || !gdeltQueries.some((query) => query.enabled)}
                    >
                      Load GDELT
                    </Button>
                  </div>
                </div>
                {error ? <p className="mt-3 text-[12px] text-red-600">{error}</p> : null}
                {linkCopied ? (
                  <p className="mt-2 text-[12px] text-emerald-700">Card link copied (item {linkCopied}).</p>
                ) : null}
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
                  ? (() => {
                      const slice = items.slice(0, boardCap);
                      const grouped =
                        boardSort === "topic"
                          ? groupItemsByTopic(slice)
                          : boardSort === "tag"
                            ? groupItemsByTag(slice)
                            : null;
                      let index = 0;
                      const renderItem = (item: Item) => {
                        const cardIndex = index++;
                        return (
                          <ItemCard
                            key={item.id}
                            item={item}
                            source={byId.get(item.sourceId)}
                            onTag={(tag, event) => clickItemTag(item, tag, event)}
                            onPlace={focusPlace}
                            onVendor={toggleVendor}
                            onSource={focusSource}
                            onOpen={() => openItem(item)}
                            onHide={() => hideItem(item)}
                            onRead={() => readItem(item)}
                            onReclassify={(event) => openCardMenu(item, event)}
                            onCopyLink={() => void copyCardLinkFor(item)}
                            cardAnchorId={cardAnchorId(item.id)}
                            read={triage.read.includes(itemKey(item.id))}
                            focused={focusIndex === cardIndex}
                          />
                        );
                      };
                      if (!grouped || grouped.length <= 1) return slice.map((item) => renderItem(item));
                      return grouped.flatMap((group) => [
                        <div
                          key={`scan-head-${group.key}`}
                          className="board-section-head sm:col-span-2 lg:col-span-3"
                        >
                          {group.key}
                        </div>,
                        ...group.items.map((item) => renderItem(item)),
                      ]);
                    })()
                  : viewDesk === "pulse"
                    ? stories.slice(0, 12).map((story, index) => (
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
                          onReclassify={(event) => {
                            const head = story.items[0];
                            if (head) openCardMenu(head, event, story);
                          }}
                          onCopyLink={() => {
                            const head = story.items[0];
                            if (head) void copyCardLinkFor(head);
                          }}
                          cardAnchorId={
                            story.items[0] ? cardAnchorId(story.items[0].id) : undefined
                          }
                          read={triage.read.includes(`story:${story.id}`)}
                          focused={focusIndex === index}
                        />
                      ))
                    : stories.slice(0, boardCap).map((story, index) => (
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
                          onReclassify={(event) => {
                            const head = story.items[0];
                            if (head) openCardMenu(head, event, story);
                          }}
                          onCopyLink={() => {
                            const head = story.items[0];
                            if (head) void copyCardLinkFor(head);
                          }}
                          cardAnchorId={
                            story.items[0] ? cardAnchorId(story.items[0].id) : undefined
                          }
                          read={triage.read.includes(`story:${story.id}`)}
                          focused={focusIndex === index}
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
                  stack={stack}
                  onDesk={changeDesk}
                  onReclassifyItem={(item, event) => openCardMenu(item, event, openStory)}
                  onCopyCardLink={(item) => void copyCardLinkFor(item)}
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
      {cardMenu ? (
        <CardContextMenu
          x={cardMenu.x}
          y={cardMenu.y}
          currentTopics={cardMenu.item.topics}
          onAction={(action) => void handleCardMenuAction(action)}
          onClose={() => setCardMenu(null)}
        />
      ) : null}
      <CommandPalette
        open={paletteOpen}
        mode={paletteMode}
        sources={state.sources}
        places={places.map(([name]) => name)}
        watches={state.watches ?? []}
        customDesks={customDesks}
        onClose={() => setPaletteOpen(false)}
        onAction={(action) => {
          if (action.kind === "desk") changeDesk(action.desk);
          if (action.kind === "place") focusPlace(action.place);
          if (action.kind === "source") focusSource(action.sourceId);
          if (action.kind === "search") document.getElementById("board-search")?.focus();
          if (action.kind === "refresh") void refresh();
          if (action.kind === "help") {
            setPaletteMode("help");
            setPaletteOpen(true);
            return;
          }
          if (action.kind === "watch-current") {
            setPaletteOpen(false);
            return;
          }
          if (action.kind === "watch") {
            setQuery(action.watch.query);
            if (action.watch.desk) setDesk(action.watch.desk as Desk);
          }
          setPaletteOpen(false);
        }}
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
