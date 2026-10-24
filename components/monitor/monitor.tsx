"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
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
import { ContextMenu, menuAnchor } from "@/components/monitor/context-menu";
import { storySearchLine } from "@/lib/story-keywords";
import { itemTopicChips, storyTopicChips, uniquePlaces } from "@/lib/card-tags";
import { MonitorToolbar } from "@/components/monitor/monitor-toolbar";
import { Ago } from "@/components/monitor/ago";
import {
  CacheCard,
  HealthCard,
  ItemCard,
  RankedCard,
  SourceLayerCard,
  StoryCard,
  type CardChip,
} from "@/components/monitor/cards";
import { PulseCard, TopicMix, TrendList } from "@/components/monitor/charts";
import { FilterTuner } from "@/components/monitor/filter-tuner";
import { CommandPalette } from "@/components/monitor/command-palette";
import { QueryBuilderButton } from "@/components/monitor/query-builder";
import { ActiveReportToast } from "@/components/monitor/active-report-toast";
import { CorpusStatsCard } from "@/components/monitor/corpus-stats-card";
import {
  SetupMonitoringWizard,
  SETUP_WIZARD_DISMISSED_KEY,
} from "@/components/monitor/setup-monitoring-wizard";
import { EntityDesk, HomeDashboard } from "@/components/monitor/dashboard";
import { PeopleDesk } from "@/components/monitor/people-desk";
import { LiveFilterForm } from "@/components/monitor/live-filter-form";
import { SourceContextMenu } from "@/components/monitor/source-context-menu";
import { RssLibrary } from "@/components/rss/library";
import { PlacePane } from "@/components/monitor/place-pane";
import { SourcePane } from "@/components/monitor/source-pane";
import { placeMarkers } from "@/components/monitor/map";

const SituationMap = dynamic(
  () => import("@/components/monitor/situation-map").then((mod) => ({ default: mod.SituationMap })),
  { ssr: false, loading: () => null },
);
import { DeskNestList } from "@/components/monitor/desk-nests";
import { DeskRail, DeskTabs } from "@/components/monitor/nav";
import { GdeltButton } from "@/components/monitor/gdelt-panel";
import { RedditButton } from "@/components/monitor/reddit-panel";
import { RedditRssBanner } from "@/components/monitor/reddit-rss-banner";
import {
  BoardFilterToggle,
  DismissFilterChip,
  ToggleFilterChip,
} from "@/components/monitor/filter-chip";
import { InvestigationBar } from "@/components/monitor/investigation-bar";
import type { ReaderContextChip } from "@/components/monitor/reader-context-strip";
import { Tip } from "@/components/monitor/tip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import type { BoardFilters } from "@/lib/board-state";
import { defaultBoardFilters, normalizeBoardFilters, syncBoardUrl } from "@/lib/board-state";
import { isKnownTopic, isSportSubtag, itemHasTopic } from "@/lib/classify";
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
import { coordsForPlace, homeCity, type MapMarker } from "@/lib/geo";
import { markersForStories } from "@/lib/story-markers";
import { matchesStack, type KevEntry, type PatchRisk } from "@/lib/kev";
import { matchesLane, type SituationLane } from "@/lib/lanes";
import { kevForStory, itemsForCve, relatedStories, similarStories } from "@/lib/link";
import { collectBoardCveIds } from "@/lib/card-cves";
import { kevCatalogSet, storyCorroboration } from "@/lib/story-corroboration";
import { countBoardItemsForTrend } from "@/lib/trend-board-bridge";
import type { TrendRow } from "@/lib/trends";
import { findMatchingSavedFilter } from "@/lib/saved-filter-match";
import type { SearchSuggestData } from "@/lib/search-suggest";
import { epssLabel, epssTone, type EpssScore } from "@/lib/vuln-intel";
import {
  FirstRunChecklist,
  FIRST_RUN_CHECKLIST_KEY,
} from "@/components/monitor/first-run-checklist";
import { isAdvisoryItem, itemHasVendor, matchVendorName, mineItem, vendorFamily } from "@/lib/mine";
import { withItemLimitQuery } from "@/lib/board-limit";
import {
  groupItemsByTag,
  groupItemsByTopic,
  groupStoriesForBrief,
  loadBoardSort,
  saveBoardSort,
  sortItems,
  sortStories,
  type BoardSort,
} from "@/lib/board-sort";
import { applyBoardItemFilters } from "@/lib/board-item-filter";
import { itemMatchesAnyNest, suggestDeskFacets } from "@/lib/desk-nests";
import { rssFeedCategory } from "@/lib/rss-library";
import { activeFilterCount, deskLabel as investigationDeskLabel } from "@/lib/investigation-summary";
import { loadMyBriefing, type MyBriefingProfile } from "@/lib/briefing-profile";
import { applyTopicOverride, loadItemTopicOverrides, saveItemTopicOverride } from "@/lib/item-overrides";
import { loadSavedFilters, type SavedFilter } from "@/lib/saved-filters";
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
import { isBuiltinDesk, type BuiltinDesk } from "@/lib/types";
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
import { uniqueById, type WeatherEvent } from "@/lib/weather";
import type { NaturalEvent, OutageRow } from "@/lib/hazards";
import { SourcesTable } from "@/components/monitor/sources-table";
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
import { ensurePoliticsUserDesk, findPoliticsUserDesk } from "@/lib/desk-presets";
import {
  addDeskNest,
  createUserDesk,
  deleteUserDesk,
  findUserDesk,
  loadUserDesks,
  removeDeskNest,
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

/** With the server scheduler on, the board only re-reads SQLite; the server does the fetching. */
const SERVER_SYNC_MS = 2 * 60 * 1000;

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
  const [nest, setNest] = useState<string[]>(seed.nest ?? []);
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
  const [naturalEvents, setNaturalEvents] = useState<NaturalEvent[]>([]);
  const [outages, setOutages] = useState<OutageRow[]>([]);
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
  const [skippedFollow, setSkippedFollow] = useState<string[]>([]);
  const [boardItemLimit, setBoardItemLimit] = useState(() => loadOptions().boardItemLimit);
  const [triage, setTriage] = useState<TriageState>({ hidden: [], read: [] });
  const [triageUndo, setTriageUndo] = useState<TriageUndo[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [sourcesView, setSourcesView] = useState<"tiles" | "table">("tiles");
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  const [savedViewsTab, setSavedViewsTab] = useState<"filters" | "briefing" | "watches">("filters");
  const [setupWizardOpen, setSetupWizardOpen] = useState(false);
  const [firstRunDismissed, setFirstRunDismissed] = useState(true);
  const [hasBriefingProfile, setHasBriefingProfile] = useState(false);
  const [tunerDraft, setTunerDraft] = useState<{ filters: BoardFilters; view: BuiltinDesk } | null>(
    null,
  );
  const [reportToast, setReportToast] = useState<{ id: string; title: string; count: number } | null>(
    null,
  );
  const [paletteSavedFilters, setPaletteSavedFilters] = useState<SavedFilter[]>([]);
  const [paletteBriefing, setPaletteBriefing] = useState<MyBriefingProfile | null>(null);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
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
  const [liveFilterOpen, setLiveFilterOpen] = useState(false);
  const [liveFilterSeed, setLiveFilterSeed] = useState({ name: "", criteria: "" });
  const [poolMenu, setPoolMenu] = useState<{ x: number; y: number; sourceId: number } | null>(null);
  const [cardMenu, setCardMenu] = useState<{
    item: Item;
    story: Story | null;
    x: number;
    y: number;
  } | null>(null);
  const [chipMenu, setChipMenu] = useState<{ chip: CardChip; x: number; y: number } | null>(null);
  const [epss, setEpss] = useState<Map<string, EpssScore>>(() => new Map());
  const epssRequested = useRef(new Set<string>());
  const [patchOrder, setPatchOrder] = useState<"cisa" | "epss">("cisa");
  const [notice, setNotice] = useState<string | null>(null);
  const [displayCollection, setDisplayCollection] = useState<DisplayCollection | null>(null);
  const [focusItem, setFocusItem] = useState<number | null>(seed.focusItem ?? null);
  const [linkCopied, setLinkCopied] = useState<number | null>(null);
  const focusItemHandled = useRef<number | null>(null);
  const [autoRefreshMinutes, setAutoRefreshMinutes] = useState(0);
  const [serverScheduler, setServerScheduler] = useState(false);

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
    setFirstRunDismissed(window.localStorage.getItem(FIRST_RUN_CHECKLIST_KEY) === "1");
    setHasBriefingProfile(Boolean(loadMyBriefing()));
    setTopicOverrides(loadItemTopicOverrides());
    setAutoRefreshMinutes(opts.autoRefreshMinutes);
    setReports(loadReports());
    void hydrateReports().then((rows) => {
      if (!cancelled) setReports(rows);
    });
    setOpenReportId(loadActiveReportId());
    setReaderWidth(loadReaderWidth());
    setFollowOpen(window.localStorage.getItem("csmon.follow-open") !== "0");
    try {
      const raw = window.localStorage.getItem("csmon.follow-skip");
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      setSkippedFollow(Array.isArray(parsed) ? parsed.filter((row) => typeof row === "string") : []);
    } catch {
      setSkippedFollow([]);
    }
    setUnreadOnly(window.localStorage.getItem("csmon.unread-only") === "1");
    setSourcesView(window.localStorage.getItem("csmon.sources-view") === "table" ? "table" : "tiles");
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
        void apiFetch("/api/hazards")
          .then((res) => (res.ok ? (res.json() as Promise<{ natural?: NaturalEvent[]; outages?: OutageRow[] }>) : null))
          .then((data) => {
            if (cancelled || !data) return;
            setNaturalEvents(data.natural ?? []);
            setOutages(data.outages ?? []);
          })
          .catch(() => {});
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
          if (!cancelled) setWeatherEvents(uniqueById(data.events ?? []));
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
      nest,
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
    nest,
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

  useEffect(() => {
    window.localStorage.setItem("csmon.unread-only", unreadOnly ? "1" : "0");
  }, [unreadOnly]);

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
    nest,
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
    let cancelled = false;
    void apiFetch("/api/scheduler")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { enabled?: boolean } | null) => {
        if (!cancelled) setServerScheduler(Boolean(data?.enabled));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (serverScheduler) {
      const id = window.setInterval(() => {
        if (document.visibilityState !== "visible") return;
        void json<MonitorState>(statePath("/api/state", boardItemLimit, deferredQuery))
          .then(setState)
          .catch(() => undefined);
      }, SERVER_SYNC_MS);
      return () => window.clearInterval(id);
    }
    if (!autoRefreshMinutes) return;
    const ms = autoRefreshMinutes * 60_000;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refresh({ skipGdelt: true, skipReddit: true, skipAcled: true });
    }, ms);
    return () => window.clearInterval(id);
  }, [autoRefreshMinutes, boardItemLimit, deferredQuery, serverScheduler]);

  const baseItems = useMemo(() => {
    const filters: BoardFilters = {
      desk,
      q: deferredQuery,
      topic,
      topics: filterTopics,
      place,
      tags: filterTags,
      nest: [],
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
    return applyBoardItemFilters(boardItems, filters, byId, {
      viewDesk,
      filterTopics,
      filterTags,
      displayItemIds: displayCollection?.itemIds,
      triageHidden: triage.hidden,
    });
  }, [
    boardItems,
    byId,
    cross,
    deferredQuery,
    desk,
    displayCollection,
    filterTags,
    filterTopics,
    focusItem,
    layer,
    origin,
    person,
    place,
    platform,
    qb,
    range,
    ransomware,
    riskFilter,
    rising,
    stack,
    topic,
    triage.hidden,
    vendor,
    viewDesk,
  ]);

  const trends = useMemo(() => buildTrends(baseItems, range, byId), [baseItems, byId, range]);
  const hotKeys = useMemo(() => risingKeySet(trends), [trends]);
  const kevCveIds = useMemo(() => kevCatalogSet(state.kev), [state.kev]);
  const storyCorr = useMemo(
    () => (story: Story) => storyCorroboration(story, byId, hotKeys, kevCveIds),
    [byId, hotKeys, kevCveIds],
  );
  const tunerLivePreview = useMemo(() => {
    if (!deskEditorOpen || !tunerDraft) return null;
    const { filters, view } = tunerDraft;
    const ranged = state.items.filter((item) => {
      const source = byId.get(item.sourceId);
      if (!source?.enabled) return false;
      return itemInTimeRange(item, filters.range);
    });
    const board = ranged.map((item) => applyTopicOverride(item, topicOverrides));
    let matched = applyBoardItemFilters(board, filters, byId, {
      viewDesk: view,
      filterTopics: filters.topics,
      filterTags: filters.tags,
    });
    if (filters.rising) {
      const draftTrends = buildTrends(matched, filters.range, byId);
      const keys = risingKeySet(draftTrends);
      matched = matched.filter((item) =>
        itemMatchesRising(item, keys, byId.get(item.sourceId)),
      );
    }
    const itemCount = matched.length;
    if (view === "scan") return { items: itemCount, stories: null as number | null };
    const pool = clusterItems(matched);
    const allowed = new Set(matched.map((item) => item.id));
    const storyRows = storiesFromPool(pool, allowed, filters.cross, []);
    return { items: itemCount, stories: storyRows.length };
  }, [byId, deskEditorOpen, state.items, topicOverrides, tunerDraft]);
  const cveHits = useMemo(() => minedCves(baseItems).slice(0, 6), [baseItems]);

  const nestFacets = useMemo(
    () => suggestDeskFacets(baseItems, activeCustom?.filters.topic ?? null),
    [activeCustom, baseItems],
  );

  const items = useMemo(() => {
    const pool = baseItems.filter((item) => itemMatchesAnyNest(item, nest));
    const filtered = !rising
      ? pool
      : pool.filter((item) => itemMatchesRising(item, hotKeys, byId.get(item.sourceId)));
    return sortItems(filtered, boardSort);
  }, [baseItems, boardSort, byId, hotKeys, nest, rising]);

  const stories = useMemo(() => {
    const allowed = new Set(items.map((item) => item.id));
    let rows = sortStories(storiesFromPool(poolStories, allowed, cross, triage.hidden), boardSort);
    if (unreadOnly) {
      rows = rows.filter((story) => !triage.read.includes(`story:${story.id}`));
    }
    return rows;
  }, [boardSort, cross, items, poolStories, triage.hidden, unreadOnly, triage.read]);

  const visibleItems = useMemo(() => {
    if (!unreadOnly) return items;
    return items.filter((item) => !triage.read.includes(itemKey(item.id)));
  }, [items, unreadOnly, triage.read]);

  const boardUnreadCount = useMemo(() => {
    if (viewDesk === "scan") {
      return baseItems.filter((item) => !triage.read.includes(itemKey(item.id))).length;
    }
    const allowed = new Set(baseItems.map((item) => item.id));
    const pool = storiesFromPool(poolStories, allowed, cross, triage.hidden);
    return pool.filter((story) => !triage.read.includes(`story:${story.id}`)).length;
  }, [baseItems, cross, poolStories, triage.hidden, triage.read, viewDesk]);

  const boardList = useMemo(() => {
    if (viewDesk === "scan") {
      return visibleItems.slice(0, boardCap).map((item) => ({ kind: "item" as const, item }));
    }
    const rows = viewDesk === "pulse" ? stories.slice(0, 12) : stories.slice(0, boardCap);
    return rows.map((story) => ({ kind: "story" as const, story }));
  }, [boardCap, stories, viewDesk, visibleItems]);

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

  const searchData = useMemo((): SearchSuggestData => {
    const authors = new Map<string, number>();
    for (const item of rangedItems) {
      if (item.author) authors.set(item.author, (authors.get(item.author) ?? 0) + 1);
    }
    return {
      source: state.sources.filter((s) => s.enabled).map((s) => s.name),
      place: places.map(([name]) => name),
      topic: topics.map(([name]) => name),
      vendor: vendors.map(([name]) => name),
      author: [...authors.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name),
    };
  }, [places, rangedItems, state.sources, topics, vendors]);

  const kevFiltered = useMemo(() => {
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

  useEffect(() => {
    const fromBoard = collectBoardCveIds(
      viewDesk,
      items,
      stories,
      boardCap,
      kevFiltered.slice(0, 400).map((entry) => entry.cveId),
    );
    const wanted = fromBoard.filter((id) => !epssRequested.current.has(id)).slice(0, 48);
    if (!wanted.length) return;
    for (const id of wanted) epssRequested.current.add(id);
    void json<{ scores: EpssScore[] }>(`/api/epss?cves=${encodeURIComponent(wanted.join(","))}`)
      .then((data) => {
        setEpss((current) => {
          const next = new Map(current);
          for (const row of data.scores) next.set(row.cve, row);
          return next;
        });
      })
      .catch(() => {
        for (const id of wanted) epssRequested.current.delete(id);
      });
  }, [boardCap, items, kevFiltered, stories, viewDesk]);

  const kev = useMemo(() => {
    if (patchOrder !== "epss") return kevFiltered;
    return [...kevFiltered].sort((a, b) => (epss.get(b.cveId)?.epss ?? -1) - (epss.get(a.cveId)?.epss ?? -1));
  }, [epss, kevFiltered, patchOrder]);

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
  const followHints = state.hints
    .filter((hint) => !skippedFollow.includes(hint.host))
    .slice(0, 6);

  const brief = situationLine(stories, state.sources);
  const p0 = state.kev.filter((k) => k.risk === "p0").length;
  const ransomwareCount = kev.filter((k) => k.ransomware).length;
  const advisoryCount = useMemo(() => {
    if (viewDesk === "advisories") return stories.length;
    return rangedItems.filter((item) => isAdvisoryItem(item, byId.get(item.sourceId))).length;
  }, [byId, rangedItems, stories.length, viewDesk]);
  const rssFeeds = useMemo(
    () =>
      state.sources
        .filter((source) => source.enabled && source.platform === "rss")
        .map((source) => ({
          id: source.id,
          name: source.name,
          category: rssFeedCategory(source),
          url: source.feedUrl ?? source.url,
        }))
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    [state.sources],
  );
  const rssArticles = useMemo(() => {
    const ids = new Set(rssFeeds.map((feed) => feed.id));
    return rangedItems
      .filter((item) => ids.has(item.sourceId))
      .map((item) => ({
        id: item.id,
        feedId: item.sourceId,
        title: item.title,
        summary: item.summary ?? "",
        url: item.url,
        publishedAt: item.publishedAt,
      }));
  }, [rangedItems, rssFeeds]);

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
    event.stopPropagation();
    setChipMenu(null);
    setCardMenu({ item, story, ...menuAnchor(event) });
  }

  function openChipMenu(chip: CardChip, event: ReactMouseEvent) {
    event.preventDefault();
    setCardMenu(null);
    setChipMenu({ chip, ...menuAnchor(event) });
  }

  function flashNotice(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice((current) => (current === text ? null : current)), 3500);
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      flashNotice(`Copied ${label}`);
    } catch {
      setError("Could not copy to the clipboard");
    }
  }

  async function createWatch(query: string, name: string) {
    const line = window.prompt("Watch query (same syntax as search)", query);
    if (!line?.trim()) return;
    try {
      const res = await apiFetch("/api/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.slice(0, 80) || line.trim(), query: line.trim(), notifyUrl: null, desk: viewDesk }),
      });
      const data = (await res.json()) as { watches?: Watchlist[]; error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      if (data.watches) setStateRaw((current) => ({ ...current, watches: data.watches ?? [] }));
      flashNotice(`Watching “${line.trim()}”`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save watch");
    }
  }

  function appendQueryToken(token: string) {
    setQuery((current) => [current.trim(), token].filter(Boolean).join(" "));
  }

  async function handleChipMenuAction(kind: "filter" | "exclude" | "watch" | "only" | "mute" | "refresh" | "copy-feed") {
    if (!chipMenu) return;
    const { chip } = chipMenu;
    setChipMenu(null);
    const token = `${chip.kind}:${/\s/.test(chip.value) ? `"${chip.value}"` : chip.value}`;
    if (chip.kind === "source") {
      const source = byId.get(chip.sourceId);
      if (kind === "only" || kind === "filter") focusSource(chip.sourceId);
      else if (kind === "exclude") appendQueryToken(`-${token}`);
      else if (kind === "mute" && source) {
        await toggleLayer(source.id, true);
        flashNotice(`Muted ${source.name}`);
      } else if (kind === "refresh" && source) void refreshLayer(source.id);
      else if (kind === "copy-feed" && source) void copyText(source.feedUrl ?? source.url, "feed URL");
      else if (kind === "watch") void createWatch(token, chip.value);
      return;
    }
    if (kind === "filter") {
      if (chip.kind === "topic") toggleTopic(chip.value);
      else if (chip.kind === "place") focusPlace(chip.value);
      else toggleVendor(chip.value);
    } else if (kind === "exclude") {
      appendQueryToken(`-${token}`);
    } else if (kind === "watch") {
      void createWatch(token, chip.value);
    }
  }

  async function refreshLayer(id: number) {
    setRefreshing(true);
    try {
      setState(
        await json<MonitorState>(statePath("/api/refresh", boardItemLimit), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [id] }),
        }),
      );
      flashNotice(`Refreshed ${byId.get(id)?.name ?? "layer"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  function filtersSnapshot(): BoardFilters {
    return normalizeBoardFilters({
      desk,
      q: query,
      topic,
      topics: filterTopics,
      place,
      tags: filterTags,
      nest,
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
    const target = story ?? storyContaining(item, poolStories) ?? itemAsStory(item);
    const source = byId.get(item.sourceId);

    if (action.kind === "open") {
      openReader(target);
      return;
    }
    if (action.kind === "open-original") {
      window.open(item.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (action.kind === "report") {
      reportStory(target);
      return;
    }
    if (action.kind === "hide") {
      if (story) hideStory(story);
      else hideItem(item);
      return;
    }
    if (action.kind === "read") {
      if (story) readStory(story);
      else readItem(item);
      return;
    }
    if (action.kind === "watch") {
      void createWatch(storySearchLine(target.title, mineItem(item).cves), target.title);
      return;
    }
    if (action.kind === "find-coverage") {
      const line = storySearchLine(target.title);
      if (!line) return;
      setLayer(null);
      setQuery(line);
      if (viewDesk === "home" || viewDesk === "sources") setDesk("brief");
      return;
    }
    if (action.kind === "only-source") {
      focusSource(item.sourceId);
      return;
    }
    if (action.kind === "mute-source") {
      if (source) {
        await toggleLayer(source.id, true);
        flashNotice(`Muted ${source.name}`);
      }
      return;
    }
    if (action.kind === "filter-topic") {
      toggleTopic(action.topic);
      return;
    }
    if (action.kind === "filter-place") {
      focusPlace(action.place);
      return;
    }
    if (action.kind === "copy-citation") {
      const when = item.publishedAt ? new Date(item.publishedAt).toISOString().slice(0, 10) : "undated";
      void copyText(`[${item.title}](${item.url}) — ${source?.name ?? "source"}, ${when}`, "citation");
      return;
    }
    if (action.kind === "copy-title") {
      void copyText(`${item.title}\n${item.url}`, "title and URL");
      return;
    }

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
      nest: [],
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

  async function runSetupMonitoring(opts: {
    packs: IntelPack[];
    loadKev: boolean;
    homePlace: string;
    watchName: string;
    watchQuery: string;
    createWatch: boolean;
    pinPoliticsDesk: boolean;
    openPoliticsDesk: boolean;
  }) {
    setBusy(true);
    setError(null);
    try {
      changeHomePlace(opts.homePlace);
      let desks = customDesks;
      if (opts.pinPoliticsDesk || opts.packs.includes("politics")) {
        desks = ensurePoliticsUserDesk(desks);
        setCustomDesks(desks);
      }
      for (const pack of opts.packs) {
        setState(
          await json<MonitorState>(statePath("/api/intel", boardItemLimit), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pack, enable: true }),
          }),
        );
      }
      if (opts.loadKev) {
        setState(
          await json<MonitorState>(statePath("/api/kev", boardItemLimit), {
            method: "POST",
          }),
        );
      }
      if (opts.createWatch && opts.watchQuery.trim()) {
        const res = await apiFetch("/api/watchlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: opts.watchName.trim() || opts.watchQuery.trim(),
            query: opts.watchQuery.trim(),
            notifyUrl: null,
            desk: "home",
          }),
        });
        const data = (await res.json()) as { watches?: Watchlist[]; error?: string };
        if (!res.ok) throw new Error(data.error || res.statusText);
        if (data.watches) setStateRaw((current) => ({ ...current, watches: data.watches ?? [] }));
      }
      const politicsDesk = findPoliticsUserDesk(desks);
      if (opts.openPoliticsDesk && politicsDesk) {
        applyFilters({ ...politicsDesk.filters, desk: politicsDesk.id });
      } else if (opts.packs.includes("politics")) {
        setDesk("brief");
        setTopic("politics");
      } else {
        setDesk("home");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
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
      if (pack === "politics") {
        setCustomDesks((prev) => ensurePoliticsUserDesk(prev));
        setDesk("brief");
        setTopic("politics");
      }
      if (pack === "hazard") setDesk("home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Intel pack failed");
    } finally {
      setBusy(false);
    }
  }

  function openLiveFilter(name = "", criteria = "") {
    setLiveFilterSeed({ name, criteria });
    setLiveFilterOpen(true);
  }

  function saveLiveFilter(name: string, criteria: string) {
    const filters = normalizeBoardFilters({
      ...defaultBoardFilters(stack),
      q: criteria,
      range,
      desk: "brief",
    });
    const next = createUserDesk(name, filters, customDesks, "brief");
    setCustomDesks(next);
    const created = next.find((row) => row.label.toLowerCase() === name.trim().toLowerCase()) ?? next[0];
    if (created) applyFilters(created.filters);
  }

  function applyFilters(next: BoardFilters) {
    const filters = normalizeBoardFilters(next);
    setDesk(filters.desk);
    setQuery(filters.q);
    setTopic(filters.topic);
    setFilterTopics(filters.topics);
    setFilterTags(filters.tags);
    setNest(filters.nest);
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
    setNest([]);
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
    nest.length > 0 ||
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

  function clearHomeDashboard() {
    setTopic(null);
    setPlace(null);
    setLayer(null);
    setPerson(null);
    setPlatform(null);
    setRising(false);
    setQuery("");
    setQb(emptyQuery());
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
      setWeatherEvents(uniqueById(data.events ?? []));
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
          setWeatherEvents(uniqueById(data.events ?? []));
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
    setError(null);
    try {
      setState(
        await json<MonitorState>(statePath("/api/explore", boardItemLimit), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ host, url }),
        }),
      );
      flashNotice(`Added ${host} as a layer`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Follow failed");
    } finally {
      setBusy(false);
    }
  }

  function skipFollowHost(host: string) {
    setSkippedFollow((current) => {
      const next = [...new Set([...current, host])].slice(-240);
      window.localStorage.setItem("csmon.follow-skip", JSON.stringify(next));
      return next;
    });
    flashNotice(`Skipped ${host}`);
  }

  function toggleVendor(name: string) {
    const canon = matchVendorName(name) ?? name;
    setVendor((current) => (current === canon ? null : canon));
  }

  function toggleNest(name: string) {
    const key = name.trim().toLowerCase();
    if (!key) return;
    setNest((current) => (current.includes(key) ? current.filter((row) => row !== key) : [...current, key]));
  }

  function clickChip(name: string) {
    const vendor = matchVendorName(name);
    if (vendor) {
      toggleVendor(vendor);
      return;
    }
    if (isKnownPlace(name) && !isKnownTopic(name) && !isSportSubtag(name)) {
      focusPlace(name);
      return;
    }
    if (activeCustom || isSportSubtag(name)) {
      toggleNest(name);
      return;
    }
    if (name.toLowerCase() === "ai" || isKnownTopic(name)) {
      toggleTopic(name.toLowerCase() === "ai" ? "ai" : name);
      return;
    }
    toggleNest(name);
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

  function openSourcePreview(id: number) {
    setOpenSourceId((current) => (current === id ? null : id));
    setSelectedFlight(null);
    setAircraft(null);
    closeReader();
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

  function flashReportToast(id: string, rows: typeof reports) {
    const report = openReports(rows).find((row) => row.id === id);
    if (!report) return;
    setReportToast({ id: report.id, title: report.title, count: report.stories.length });
    window.setTimeout(() => setReportToast((current) => (current?.id === id ? null : current)), 5000);
  }

  function reportFocused() {
    const story = focusedStory();
    if (story) reportStory(story);
  }

  function handleReportsChange(rows: Report[]) {
    setReports(rows);
    const active = loadActiveReportId();
    if (active && rows.some((row) => row.id === active)) {
      setOpenReportId(active);
    }
  }

  /** Switch the active briefing without leaving the reader or changing desk. */
  function selectActiveReport(id: string) {
    setOpenReportId(id);
    saveActiveReportId(id);
  }

  function reportStory(story: Story) {
    const snap = snapshotStory(story, byId);
    const live = openReports(reports);
    const target = live.find((row) => row.id === openReportId) ?? live[0];
    if (target) {
      const rows = addStoryToReport(target.id, snap, reports);
      handleReportsChange(rows);
      flashReportToast(target.id, rows);
      return;
    }
    const next = createReport(story.title, snap, reports);
    handleReportsChange(next.rows);
    flashReportToast(next.report.id, next.rows);
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
        return;
      }
      if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
        const row = boardList[focusIndex];
        const story = row?.kind === "story" ? row.story : null;
        const item = row ? (row.kind === "story" ? row.story.items[0] : row.item) : null;
        if (!item) return;
        event.preventDefault();
        const el = document.getElementById(cardAnchorId(item.id));
        const rect = el?.getBoundingClientRect();
        setChipMenu(null);
        setCardMenu({ item, story, x: rect ? rect.left + 12 : 80, y: rect ? rect.top + 24 : 80 });
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
    viewDesk !== "reports" &&
    viewDesk !== "feeds";

  useEffect(() => {
    if (typeof window === "undefined" || !emptyBoard) return;
    if (window.localStorage.getItem(SETUP_WIZARD_DISMISSED_KEY)) return;
    setSetupWizardOpen(true);
  }, [emptyBoard]);

  const currentFilters: BoardFilters = {
    desk,
    q: query,
    topic,
    topics: filterTopics,
    place,
    tags: filterTags,
    nest,
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

  const sourceItemCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const item of items) counts.set(item.sourceId, (counts.get(item.sourceId) ?? 0) + 1);
    return counts;
  }, [items]);

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

  const activeReport = useMemo(() => {
    const open = reports.filter((row) => row.status === "open");
    if (openReportId) return open.find((row) => row.id === openReportId) ?? open[0] ?? null;
    return open[0] ?? null;
  }, [openReportId, reports]);

  function openActiveReportDesk() {
    if (!activeReport) return;
    openCompiledReport(activeReport.id);
    changeDesk("reports");
  }

  const readerContextChips = useMemo((): ReaderContextChip[] => {
    const chips: ReaderContextChip[] = [];
    const q = query.trim();
    if (q) {
      chips.push({
        id: "search",
        label: q.length > 28 ? `${q.slice(0, 28)}…` : q,
        hint: "Board search",
        onClick: () => closeReader(),
      });
    }
    if (place) chips.push({ id: "place", label: place, onClick: () => closeReader() });
    if (topic) chips.push({ id: "topic", label: topic, onClick: () => closeReader() });
    if (person) chips.push({ id: "person", label: person, onClick: () => closeReader() });
    if (vendor) chips.push({ id: "vendor", label: vendor, onClick: () => closeReader() });
    if (layer) {
      chips.push({
        id: "layer",
        label: shortSourceName(byId.get(layer)?.name ?? "source"),
        hint: "Filtered to this source layer",
        onClick: () => closeReader(),
      });
    }
    if (platform) chips.push({ id: "platform", label: platform, onClick: () => closeReader() });
    if (origin) chips.push({ id: "origin", label: origin, onClick: () => closeReader() });
    if (cross) chips.push({ id: "cross", label: "2+ sources", onClick: () => closeReader() });
    if (rising) chips.push({ id: "rising", label: "rising", onClick: () => closeReader() });
    return chips;
  }, [byId, cross, layer, origin, person, place, platform, query, rising, topic]);

  useEffect(() => {
    if (!paletteOpen && !savedViewsOpen) return;
    setPaletteSavedFilters(loadSavedFilters());
    setPaletteBriefing(loadMyBriefing());
  }, [paletteOpen, savedViewsOpen]);

  useEffect(() => {
    if (savedViewsOpen) return;
    setHasBriefingProfile(Boolean(loadMyBriefing()));
  }, [savedViewsOpen]);

  const showDossierColumn =
    viewDesk !== "flights" &&
    (Boolean(place) || (openSourceId != null && Boolean(byId.get(openSourceId))));
  const showFollowRail =
    viewDesk !== "feeds" &&
    !openStory &&
    !showDossierColumn &&
    !(viewDesk === "flights" && selectedFlight);
  const workspaceMultiColumn = openStory || showDossierColumn;

  const investigationContextLine =
    viewDesk === "patch"
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
            : viewDesk === "feeds"
              ? `${rssFeeds.length} RSS feeds · ${rssArticles.length} titles in this window`
            : viewDesk === "people"
              ? `${people.length} people on the board`
              : viewDesk === "documents"
                ? `${documents.length} reports and advisories`
                : brief;

  const coverageLine = useMemo(() => {
    if (!["home", "brief", "pulse", "weather", "scan", "advisories"].includes(viewDesk)) return undefined;
    let onMap = 0;
    for (const story of stories) {
      if (story.locations.some((name) => coordsForPlace(name))) onMap += 1;
    }
    let noPlace = 0;
    for (const item of items) {
      if (!item.locations.some((name) => coordsForPlace(name))) noPlace += 1;
    }
    return `${onMap} on the map · ${stats.fresh} sources fresh · ${noPlace} with no place`;
  }, [items, stats.fresh, stories, viewDesk]);

  const secondaryFiltersActive =
    Boolean(origin) ||
    Boolean(platform) ||
    Boolean(vendor) ||
    Boolean(ransomware) ||
    Boolean(person);

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
      ...uniqueById(weatherEvents)
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

  const trendBoardCount = useCallback(
    (row: { id: string; kind: string }) =>
      countBoardItemsForTrend(baseItems, byId, row as TrendRow),
    [baseItems, byId],
  );

  function showTrendOnBoard(row: { id: string; kind: string; label: string }) {
    openTrend(row);
    setDesk("brief");
    closeReader();
  }

  const matchingSavedFilter = useMemo(
    () => findMatchingSavedFilter(currentFilters),
    [currentFilters],
  );

  function changeDesk(next: Desk) {
    if (next === desk) return;
    const custom = findUserDesk(next, customDesks);
    if (custom) applyFilters({ ...custom.filters, nest: [] });
    else {
      setQb(emptyQuery());
      setNest([]);
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
          feeds: rssFeeds.length,
          sources: enabled.length,
          reports: reports.filter((row) => row.status === "open").length,
        }}
        customDesks={customDesks}
        onCreateDesk={() => {
          setEditingDesk(null);
          setDeskEditorOpen(true);
        }}
        onCreateFilter={() => openLiveFilter()}
        nestFacets={nestFacets}
        nestSaved={activeCustom?.nests ?? []}
        nestActive={nest}
        onToggleNest={toggleNest}
        onClearNest={() => setNest([])}
        onAddNest={(label) => {
          if (!activeCustom) return;
          setCustomDesks(addDeskNest(activeCustom.id, label, customDesks));
          toggleNest(label);
        }}
        onRemoveNest={(id) => {
          if (!activeCustom) return;
          const removed = activeCustom.nests.find((row) => row.id === id);
          setCustomDesks(removeDeskNest(activeCustom.id, id, customDesks));
          if (removed) setNest((current) => current.filter((value) => value !== removed.query.toLowerCase()));
        }}
        onEditDesk={(id) => {
          setEditingDesk(findUserDesk(id, customDesks));
          setDeskEditorOpen(true);
        }}
        onDeleteDesk={(id) => {
          const next = deleteUserDesk(id, customDesks);
          setCustomDesks(next);
          if (desk === id) {
            setDesk("home");
            setQuery("");
          }
        }}
        onClearFilters={clearBoardFilters}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50">
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm">
          <RedditRssBanner onMigrate={() => setRedditDialogOpen(true)} />
          <MonitorToolbar
            searchData={searchData}
            viewDesk={viewDesk}
            query={query}
            onQueryChange={setQuery}
            desk={desk}
            onDeskChange={changeDesk}
            customDesks={customDesks}
            onCreateFilter={() => openLiveFilter()}
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
            savedViewsOpen={savedViewsOpen}
            onSavedViewsOpenChange={setSavedViewsOpen}
            savedViewsTab={savedViewsTab}
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
          <InvestigationBar
            desk={desk}
            deskTitle={findUserDesk(desk, customDesks)?.label}
            range={range}
            filters={currentFilters}
            filterTopics={filterTopics}
            filterTags={filterTags}
            displayOnly={Boolean(displayCollection?.itemIds.length)}
            viewDesk={viewDesk}
            unreadCount={boardUnreadCount}
            unreadOnly={unreadOnly}
            onUnreadOnlyChange={setUnreadOnly}
            activeReportTitle={activeReport?.title ?? null}
            activeReportStories={activeReport?.stories.length ?? 0}
            onClearFilters={clearBoardFilters}
            onOpenActiveReport={openActiveReportDesk}
            filtersActive={boardFiltersActive}
            contextLine={investigationContextLine}
            coverageLine={coverageLine}
          />
          {!firstRunDismissed ? (
            <FirstRunChecklist
              enabledLayers={enabled.length}
              hasBriefing={hasBriefingProfile}
              onSetUpMonitoring={() => setSetupWizardOpen(true)}
              onOpenSaved={() => {
                setSavedViewsTab("briefing");
                setSavedViewsOpen(true);
              }}
              onDismiss={() => {
                window.localStorage.setItem(FIRST_RUN_CHECKLIST_KEY, "1");
                setFirstRunDismissed(true);
              }}
            />
          ) : null}
          <div className="board-filter-strip">
            {activeCustom ? (
              <DeskNestList
                deskLabel={activeCustom.label}
                facets={nestFacets}
                saved={activeCustom.nests}
                active={nest}
                layout="bar"
                onToggle={toggleNest}
                onClear={() => setNest([])}
                onAdd={(label) => {
                  const next = addDeskNest(activeCustom.id, label, customDesks);
                  setCustomDesks(next);
                  toggleNest(label);
                }}
                onRemoveSaved={(id) => {
                  const removed = activeCustom.nests.find((row) => row.id === id);
                  setCustomDesks(removeDeskNest(activeCustom.id, id, customDesks));
                  if (removed) {
                    setNest((current) => current.filter((value) => value !== removed.query.toLowerCase()));
                  }
                }}
              />
            ) : null}
            {query.trim() ||
            (state.watches ?? []).some((watch) => watch.newHits > 0) ||
            topic ||
            filterTopics.length ||
            filterTags.length ||
            displayCollection?.itemIds.length ||
            layer ||
            platform ||
            origin ||
            (viewDesk === "patch" && riskFilter !== "all") ||
            hasQuery(qb) ||
            place ||
            person ||
            vendor ? (
              <div className="filter-chip-row filter-chip-row-applied">
                <span className="filter-chip-row-label">Active</span>
            {query.trim() ? (
              <DismissFilterChip
                label={`Search: ${query.trim().slice(0, 32)}${query.trim().length > 32 ? "…" : ""}`}
                onDismiss={() => setQuery("")}
                variant="search"
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
                variant="watch"
              />
            ) : null}
            {topic ? (
              <DismissFilterChip label={`Topic: ${topic}`} onDismiss={() => setTopic(null)} variant="topic" />
            ) : null}
            {filterTopics.map((name) => (
              <DismissFilterChip
                key={`ft-${name}`}
                label={`Topic: ${name}`}
                onDismiss={() => setFilterTopics((rows) => rows.filter((row) => row !== name))}
                variant="topic"
              />
            ))}
            {nest.map((name) => (
              <DismissFilterChip
                key={`nest-${name}`}
                label={name}
                tip="Remove this nested filter. The rest of the desk stays."
                onDismiss={() => setNest((rows) => rows.filter((row) => row !== name))}
                variant="topic"
              />
            ))}
            {filterTags.map((name) => (
              <DismissFilterChip
                key={`fg-${name}`}
                label={`Tag: ${name}`}
                onDismiss={() => setFilterTags((rows) => rows.filter((row) => row !== name))}
                variant="topic"
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
                variant="query"
              />
            ) : null}
            {layer ? (
              <DismissFilterChip
                label={shortSourceName(byId.get(layer)?.name ?? "layer")}
                onDismiss={() => {
                  setLayer(null);
                  setOpenSourceId(null);
                }}
                variant="layer"
              />
            ) : null}
            {platform ? (
              <DismissFilterChip label={platform} onDismiss={() => setPlatform(null)} variant="default" />
            ) : null}
            {origin ? (
              <DismissFilterChip label={`origin: ${origin}`} onDismiss={() => setOrigin(null)} variant="default" />
            ) : null}
            {viewDesk === "patch" && riskFilter !== "all" ? (
              <DismissFilterChip
                label={RISK_LABEL[riskFilter]}
                onDismiss={() => setRiskFilter("all")}
                variant="risk"
              />
            ) : null}
            {hasQuery(qb) ? (
              <DismissFilterChip
                label="query builder"
                tip={summarizeQuery(qb)}
                onDismiss={() => setQb(emptyQuery())}
                variant="query"
              />
            ) : null}
            {place ? (
              <DismissFilterChip label={place} onDismiss={() => setPlace(null)} variant="place" />
            ) : null}
            {person ? (
              <DismissFilterChip label={person} onDismiss={() => setPerson(null)} variant="person" />
            ) : null}
            {vendor ? (
              <DismissFilterChip label={vendor} onDismiss={() => setVendor(null)} variant="vendor" />
            ) : null}
              </div>
            ) : null}
            <div className="filter-chip-row">
            {triageUndo.length > 0 ? (
              <Tip text="Undo the last hide or read">
                <button
                  type="button"
                  onClick={() => applyTriage(undoTriage(triage, triageUndo))}
                  className="filter-chip filter-chip-toggle inline-flex items-center gap-0.5"
                >
                  <Undo2 className="size-2.5" />
                  <span className="filter-chip-label">Undo</span>
                </button>
              </Tip>
            ) : null}
            {viewDesk === "patch" ? (
              <>
                {(["all", "p0", "p1", "p2"] as const).map((id) => (
                  <BoardFilterToggle
                    key={id}
                    label={id === "all" ? "all" : RISK_LABEL[id]}
                    active={riskFilter === id}
                    onClick={() => setRiskFilter(id)}
                  />
                ))}
                <BoardFilterToggle
                  label="ransomware"
                  active={ransomware}
                  accent="danger"
                  onClick={() => setRansomware((v) => !v)}
                />
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
                <span className="filter-chip-row-label">
                  <Layers className="size-3" aria-hidden />
                  {enabled.length} layers
                </span>
                <BoardFilterToggle
                  label="2+ sources"
                  active={cross}
                  onClick={() => setCross((v) => !v)}
                />
                <BoardFilterToggle
                  label={`rising ${trends.rising.length + trends.fresh.length}`}
                  active={rising}
                  accent="rise"
                  tip={`Keep coverage that is rising or new (${trends.compared})`}
                  onClick={() => setRising((value) => !value)}
                />
                {pinnedPlaceCounts.map(([name, count]) => {
                  const active = place === name;
                  return (
                    <ToggleFilterChip
                      key={`pin-${name}`}
                      label={`${name} ${count}`}
                      active={active}
                      accent="place"
                      tip={
                        active
                          ? `Remove ${name} filter`
                          : `Everything mentioning ${name} in title or summary`
                      }
                      onToggle={() => focusPlace(name)}
                      onDismiss={() => setPlace(null)}
                    />
                  );
                })}
                <BoardFilterToggle
                  label={
                    moreFiltersOpen
                      ? "Fewer filters"
                      : `More filters${secondaryFiltersActive ? " •" : ""}`
                  }
                  active={moreFiltersOpen || secondaryFiltersActive}
                  accent="more"
                  tip="Origin, platform, topics, places, vendors, CVEs, and people"
                  onClick={() => setMoreFiltersOpen((open) => !open)}
                />
                {moreFiltersOpen ? (
                  <>
                <BoardFilterToggle
                  label="ransomware"
                  active={ransomware}
                  accent="danger"
                  onClick={() => setRansomware((v) => !v)}
                />
                {(["intel", "reddit", "gdelt", "explore", "self", "follow"] as const).map((id) => (
                  <BoardFilterToggle
                    key={id}
                    label={id}
                    active={origin === id}
                    onClick={() => setOrigin((current) => (current === id ? null : id))}
                  />
                ))}
                <BoardFilterToggle
                  label="RSS"
                  active={platform === "rss"}
                  tip="Show items from RSS feeds only, then filter by place or topic"
                  onClick={() => setPlatform((current) => (current === "rss" ? null : "rss"))}
                />
                {STACK_CHIPS.map((chip) => {
                  const active =
                    chip.kind === "topic" ? topic === chip.value : vendor === chip.value;
                  return (
                    <ToggleFilterChip
                      key={chip.label}
                      label={chip.label}
                      active={active}
                      accent={chip.kind === "topic" ? "neutral" : "danger"}
                      tip={active ? `Remove ${chip.label} filter` : `Filter to ${chip.label}`}
                      onToggle={() =>
                        chip.kind === "topic" ? toggleTopic(chip.value) : toggleVendor(chip.value)
                      }
                      onDismiss={() =>
                        chip.kind === "topic" ? setTopic(null) : setVendor(null)
                      }
                    />
                  );
                })}
                {(viewDesk === "home" ? catalogTopics : topics)
                  .filter(([name]) => !STACK_TOPIC_VALUES.has(name))
                  .slice(0, 10)
                  .map(([name, count]) => {
                  const active = topic === name;
                  return (
                    <ToggleFilterChip
                      key={name}
                      label={`${name} ${count}`}
                      active={active}
                      tip={active ? `Remove ${name} filter` : `Filter this desk to ${name}`}
                      onToggle={() => toggleTopic(name)}
                      onDismiss={() => setTopic(null)}
                    />
                  );
                })}
                {places
                  .filter(([name]) => isCountry(name) && !PINNED_PLACES.includes(name as (typeof PINNED_PLACES)[number]))
                  .slice(0, 8)
                  .map(([name, count]) => {
                    const active = place === name;
                    return (
                      <ToggleFilterChip
                        key={`country-${name}`}
                        label={`${name} ${count}`}
                        active={active}
                        accent="place"
                        onToggle={() => focusPlace(name)}
                        onDismiss={() => setPlace(null)}
                      />
                    );
                  })}
                {places
                  .filter(([name]) => !isCountry(name))
                  .slice(0, 5)
                  .map(([name, count]) => {
                    const active = place === name;
                    return (
                      <ToggleFilterChip
                        key={name}
                        label={`${name} ${count}`}
                        active={active}
                        accent="place"
                        onToggle={() => focusPlace(name)}
                        onDismiss={() => setPlace(null)}
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
                      accent="danger"
                      onToggle={() => toggleVendor(name)}
                      onDismiss={() => setVendor(null)}
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
                      accent="danger"
                      tip={active ? `Clear ${cve} search` : `Search the board for ${cve}`}
                      onToggle={() => setQuery((current) => (current === cve ? "" : cve))}
                      onDismiss={() => setQuery("")}
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
                    />
                  );
                })}
                  </>
                ) : null}
                {viewDesk === "sources" ? (
              <>
                <Tip text="Switch between layer tiles and a sortable table with fetch health">
                  <Button
                    size="xs"
                    variant="outline"
                    aria-pressed={sourcesView === "table"}
                    onClick={() => {
                      const next = sourcesView === "table" ? "tiles" : "table";
                      setSourcesView(next);
                      window.localStorage.setItem("csmon.sources-view", next);
                    }}
                  >
                    {sourcesView === "table" ? "Tiles" : "Table"}
                  </Button>
                </Tip>
                <Tip text="Guided packs, home location, optional watch">
                  <Button size="xs" onClick={() => setSetupWizardOpen(true)} disabled={busy}>
                    Set up monitoring
                  </Button>
                </Tip>
                <Tip text="BBC, Guardian, NYT, and other world desks">
                  <Button size="xs" variant="outline" onClick={() => loadIntel("core")} disabled={busy}>
                    World RSS
                  </Button>
                </Tip>
                <Tip text="CISA, CSIRTS KEV, CCCS, Krebs, NCSC, and other security desks">
                  <Button size="xs" variant="outline" onClick={() => loadIntel("security")} disabled={busy}>
                    Security RSS
                  </Button>
                </Tip>
                <Tip text="Politico, Foreign Affairs, BBC Politics, Euronews, Reuters World">
                  <Button size="xs" variant="outline" onClick={() => loadIntel("politics")} disabled={busy}>
                    Politics RSS
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
          </div>
        </header>

        <div
          className={`monitor-workspace ${workspaceMultiColumn ? "monitor-workspace-row" : ""} ${
            showFollowRail ? "lg:grid lg:grid-cols-[1fr_260px]" : ""
          }`}
        >
          <main
            className={`min-w-0 flex-1 ${viewDesk === "flights" ? "flex min-h-0 flex-col" : ""}`}
          >
            {viewDesk === "feeds" ? (
              <RssLibrary feeds={rssFeeds} articles={rssArticles} />
            ) : emptyBoard ? (
              <div className="mx-auto max-w-lg px-6 py-20 text-center">
                <div className="text-lg font-semibold">Start from a desk, not a firehose</div>
                <p className="mt-2 text-[13px] text-slate-500">
                  Brief clusters world coverage. Advisories and Patch are the cyber rail: public
                  RSS plus CISA KEV, filtered to vendor, stack, and ransomware.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button size="sm" onClick={() => setSetupWizardOpen(true)} disabled={busy}>
                    Set up monitoring
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => loadIntel("core")} disabled={busy}>
                    Load world RSS
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => loadIntel("security")} disabled={busy}>
                    Load security RSS
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => loadIntel("politics")} disabled={busy}>
                    Load politics RSS
                  </Button>
                  {findPoliticsUserDesk(customDesks) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        const politics = findPoliticsUserDesk(customDesks);
                        if (politics) applyFilters({ ...politics.filters, desk: politics.id });
                      }}
                    >
                      Open Politics desk
                    </Button>
                  ) : null}
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
                <div className="card-tile patch-order">
                  <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Rank</p>
                  <div className="toolbar-segment mt-1">
                    <button type="button" data-active={patchOrder === "cisa" ? "true" : "false"} onClick={() => setPatchOrder("cisa")}>
                      CISA risk
                    </button>
                    <button type="button" data-active={patchOrder === "epss" ? "true" : "false"} onClick={() => setPatchOrder("epss")}>
                      EPSS
                    </button>
                  </div>
                  <p className="mt-1.5 text-[10.5px] leading-snug text-slate-500">
                    EPSS is FIRST&apos;s daily estimate of the chance a CVE is exploited in the next 30 days. KEV says it
                    already has been; EPSS helps order a long backlog.
                  </p>
                </div>
                {kev.slice(0, 80).map((entry) => (
                  <KevCard
                    key={entry.cveId}
                    epss={epss.get(entry.cveId)}
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
                onStoryMenu={(story, event) => {
                  const head = story.items[0];
                  if (head) openCardMenu(head, event, story);
                }}
                onChipMenu={openChipMenu}
                stories={stories}
                items={items}
                catalogTopics={catalogTopics}
                catalogSources={catalogSources}
                people={peopleCatalog}
                quakes={quakes}
                weatherEvents={weatherEvents}
                naturalEvents={naturalEvents}
                outages={outages}
                topic={topic}
                layer={layer}
                person={person}
                place={place}
                platform={platform}
                rising={rising}
                queryActive={hasQuery(qb)}
                searchQuery={query}
                onResetFilter={clearHomeDashboard}
                onOpenStory={openReader}
                onLane={openLane}
                onCategory={setTopic}
                range={range}
                activeTags={nest}
                onTopic={clickChip}
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
                corroborationFor={storyCorr}
                kevCveIds={kevCveIds}
                epss={epss}
                onCve={focusCve}
                onCopyLinkForStory={(story) => {
                  const head = story.items[0];
                  if (head) void copyCardLinkFor(head);
                }}
                cardAnchorForStory={(story) =>
                  story.items[0] ? cardAnchorId(story.items[0].id) : undefined
                }
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
              <PeopleDesk
                rows={people}
                items={items}
                sources={byId}
                activePerson={person}
                onPerson={togglePerson}
                onPreviewSource={openSourcePreview}
                onToggleSource={(id, enabledNow) => void toggleLayer(id, enabledNow)}
                onPersonAction={(name, action) => {
                  if (action === "filter") setPerson(name);
                  if (action === "copy") void navigator.clipboard.writeText(name);
                  if (action === "live") openLiveFilter(name, name);
                }}
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
                onChange={handleReportsChange}
              />
            ) : viewDesk === "sources" ? (
              <div className={`board p-2 ${compact ? "board-compact" : ""}`}>
                <CorpusStatsCard enabledLayers={enabled.length} boardItems={items.length} />
                <CacheCard entries={state.cache.entries} bytes={state.cache.bytes} />
                <HealthCard value={stats.health} fresh={stats.fresh} total={enabled.length} />
                {sourcesView === "table" ? (
                  <SourcesTable
                    sources={visibleSources}
                    itemCounts={sourceItemCounts}
                    activeId={layer}
                    onOpen={focusSource}
                    onRefresh={(id) => void refreshLayer(id)}
                    onToggle={(id) => void toggleLayer(id, true)}
                    onMenu={(source, event) =>
                      openChipMenu({ kind: "source", value: source.name, sourceId: source.id }, event)
                    }
                  />
                ) : null}
                {sourcesView === "table" ? null : visibleSources.map((source) => (
                  <SourceLayerCard
                    key={source.id}
                    source={source}
                    itemCount={sourceItemCounts.get(source.id) ?? 0}
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
                      {uniqueById(weatherEvents).slice(0, 12).map((event) => (
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
                          onShowOnBoard={showTrendOnBoard}
                          boardCount={trendBoardCount}
                        />
                        <TrendList
                          title="New"
                          rows={trends.fresh}
                          onSelect={openTrend}
                          onShowOnBoard={showTrendOnBoard}
                          boardCount={trendBoardCount}
                        />
                        <TrendList
                          title="Falling"
                          rows={trends.falling}
                          onSelect={openTrend}
                          onShowOnBoard={showTrendOnBoard}
                          boardCount={trendBoardCount}
                        />
                      </>
                    ) : null}
                    {stats.topicRows.length > 0 ? (
                      <TopicMix rows={stats.topicRows} onSelect={toggleTopic} />
                    ) : null}
                    {stats.placeRows.length > 0 ? (
                      <SituationMap
                        title="Where coverage relates"
                        markers={markersForStories(stories)}
                        stories={stories}
                        onOpenStory={(storyId) => {
                          const story = stories.find((row) => row.id === storyId);
                          if (story) openReader(story);
                        }}
                        onSelect={focusPlace}
                        onCategory={setTopic}
                        topic={topic}
                        range={range}
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
                            activeTags={nest}
                            onTag={(tag, event) => clickItemTag(item, tag, event)}
                            onPlace={focusPlace}
                            onVendor={toggleVendor}
                            onSource={focusSource}
                            onOpen={() => openItem(item)}
                            onHide={() => hideItem(item)}
                            onRead={() => readItem(item)}
                            onReclassify={(event) => openCardMenu(item, event)}
                            onChipMenu={openChipMenu}
                            onCopyLink={() => void copyCardLinkFor(item)}
                            cardAnchorId={cardAnchorId(item.id)}
                            read={triage.read.includes(itemKey(item.id))}
                            focused={focusIndex === cardIndex}
                            kevCveIds={kevCveIds}
                            epss={epss}
                            onCve={focusCve}
                          />
                        );
                      };
                      if (!grouped || grouped.length <= 1) return slice.map((item) => renderItem(item));
                      return grouped.flatMap((group) => [
                        <div key={`scan-head-${group.key}`} className="board-section-head">
                          <span>{group.key}</span>
                          <span className="board-section-head-count">{group.items.length}</span>
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
                          activeTags={nest}
                          onOpen={() => openReader(story)}
                          onTopic={clickChip}
                          onPlace={focusPlace}
                          onVendor={toggleVendor}
                          onSource={focusSource}
                          onHide={() => hideStory(story)}
                          onRead={() => readStory(story)}
                          onReclassify={(event) => {
                            const head = story.items[0];
                            if (head) openCardMenu(head, event, story);
                          }}
                          onChipMenu={openChipMenu}
                          onCopyLink={() => {
                            const head = story.items[0];
                            if (head) void copyCardLinkFor(head);
                          }}
                          cardAnchorId={
                            story.items[0] ? cardAnchorId(story.items[0].id) : undefined
                          }
                          read={triage.read.includes(`story:${story.id}`)}
                          focused={focusIndex === index}
                          corroboration={storyCorr(story)}
                          kevCveIds={kevCveIds}
                          epss={epss}
                          onCve={focusCve}
                        />
                      ))
                    : (() => {
                        const slice = stories.slice(0, boardCap);
                        let index = 0;
                        const renderStory = (story: Story) => {
                          const cardIndex = index++;
                          return (
                            <StoryCard
                              key={story.id}
                              story={story}
                              sources={byId}
                              activeTags={nest}
                              corroboration={storyCorr(story)}
                              onOpen={() => openReader(story)}
                              onTopic={clickChip}
                              onPlace={focusPlace}
                              onVendor={toggleVendor}
                              onSource={focusSource}
                              onHide={() => hideStory(story)}
                              onRead={() => readStory(story)}
                              onReclassify={(event) => {
                                const head = story.items[0];
                                if (head) openCardMenu(head, event, story);
                              }}
                              onChipMenu={openChipMenu}
                              onCopyLink={() => {
                                const head = story.items[0];
                                if (head) void copyCardLinkFor(head);
                              }}
                              cardAnchorId={
                                story.items[0] ? cardAnchorId(story.items[0].id) : undefined
                              }
                              read={triage.read.includes(`story:${story.id}`)}
                              focused={focusIndex === cardIndex}
                              kevCveIds={kevCveIds}
                              epss={epss}
                              onCve={focusCve}
                            />
                          );
                        };
                        if (viewDesk !== "brief") return slice.map((story) => renderStory(story));
                        const groups = groupStoriesForBrief(slice, boardSort, byId);
                        return groups.flatMap((group) => [
                          <div key={`brief-head-${group.key}`} className="board-section-head">
                            <span>{group.key}</span>
                            <span className="board-section-head-count">{group.stories.length}</span>
                          </div>,
                          ...group.stories.map((story) => renderStory(story)),
                        ]);
                      })()}
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
                  onSearchText={(text) => {
                    setLayer(null);
                    setQuery(/\s/.test(text) ? `"${text.slice(0, 120).replace(/"/g, "")}"` : text.slice(0, 120));
                    flashNotice("Searching the board for the selection");
                  }}
                  onWatchText={(text) => {
                    const phrase = text.slice(0, 120).replace(/"/g, "");
                    void createWatch(/\s/.test(phrase) ? `"${phrase}"` : phrase, phrase);
                  }}
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
                  onTopic={clickChip}
                  onPlace={focusPlace}
                  onVendor={toggleVendor}
                  onCve={focusCve}
                  onSource={focusSource}
                  onOpenStory={openReader}
                  onOpenItem={openItem}
                  onPerson={togglePerson}
                  reports={reports}
                  onReportsChange={handleReportsChange}
                  onActiveReportChange={selectActiveReport}
                  onOpenReport={openCompiledReport}
                  stack={stack}
                  onDesk={changeDesk}
                  onReclassifyItem={(item, event) => openCardMenu(item, event, openStory)}
                  onCopyCardLink={(item) => void copyCardLinkFor(item)}
                  boardContext={{
                    deskLabel: findUserDesk(desk, customDesks)?.label ?? investigationDeskLabel(desk),
                    range,
                    chips: readerContextChips,
                    onClearFilters: boardFiltersActive ? clearBoardFilters : undefined,
                  }}
                  hypothesisContext={
                    matchingSavedFilter?.hypotheses?.length
                      ? {
                          filterId: matchingSavedFilter.id,
                          filterName: matchingSavedFilter.name,
                          hypotheses: matchingSavedFilter.hypotheses,
                        }
                      : undefined
                  }
                />
              </div>
            </div>
          ) : null}
          {!openStory && viewDesk === "flights" && selectedFlight ? (
            <AircraftPane
              flight={selectedFlight}
              profile={aircraft}
              onClose={() => {
                setSelectedFlight(null);
                setAircraft(null);
              }}
            />
          ) : null}
          {showDossierColumn ? (
            <div className="monitor-dossier-column">
              {place ? (
                <PlacePane
                  place={place}
                  items={[...state.items]
                    .filter((item) => itemHasPlace(item, place))
                    .sort(
                      (a, b) => (b.publishedAt ?? b.fetchedAt) - (a.publishedAt ?? a.fetchedAt),
                    )}
                  rangedCount={rangedItems.filter((item) => itemHasPlace(item, place)).length}
                  sources={byId}
                  onClose={() => setPlace(null)}
                  onOpenItem={openItem}
                  onScan={() => {
                    setDesk("scan");
                    setPlace(place);
                  }}
                  onTopic={clickChip}
                  onSource={focusSource}
                />
              ) : openSourceId && byId.get(openSourceId) ? (
                <SourcePane
                  source={byId.get(openSourceId)!}
                  items={[...state.items]
                    .filter((item) => item.sourceId === openSourceId)
                    .filter(
                      (item) =>
                        !person || itemHasPerson(item, person, byId.get(item.sourceId)),
                    )
                    .sort(
                      (a, b) => (b.publishedAt ?? b.fetchedAt) - (a.publishedAt ?? a.fetchedAt),
                    )}
                  rangedCount={
                    rangedItems.filter((item) => item.sourceId === openSourceId).length
                  }
                  onClose={() => setOpenSourceId(null)}
                  onOpenItem={openItem}
                  onScan={() => {
                    setDesk("scan");
                    setLayer(openSourceId);
                  }}
                />
              ) : null}
            </div>
          ) : null}
          {showFollowRail ? (
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
                <p className="mt-1 text-[10px] leading-snug text-slate-500">
                  Hosts that keep showing up and are not layers yet.
                </p>
                <div className="mt-2 space-y-2">
                  {followHints.length === 0 ? (
                    <p className="text-[11px] text-slate-400">No new hosts in this window.</p>
                  ) : null}
                  {followHints.map((hint) => (
                    <div key={hint.host} className="rounded px-1 py-1 text-[11px]">
                      <span className="font-medium text-slate-800">{hint.host}</span>
                      <span className="text-slate-400"> · {hint.count}</span>
                      <span className="block truncate text-slate-400">{hint.sample}</span>
                      <span className="mt-1 flex gap-1">
                        <Tip text="Discover a feed and add this host as a layer">
                          <button
                            type="button"
                            className="card-action"
                            disabled={busy}
                            onClick={() => void followHint(hint.url)}
                          >
                            Add
                          </button>
                        </Tip>
                        <Tip text="Hide this host from Follow next">
                          <button
                            type="button"
                            className="card-action"
                            onClick={() => skipFollowHost(hint.host)}
                          >
                            Skip
                          </button>
                        </Tip>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                  Unused sources
                </div>
                <p className="mt-1 text-[10px] leading-snug text-slate-500">
                  Layers already collected with the switch off. Subscribe turns one on. Preview lists
                  its items without turning it on.
                </p>
                <Input
                  value={layerQuery}
                  onChange={(e) => setLayerQuery(e.target.value)}
                  placeholder="Find unused sources"
                  aria-label="Find unused sources"
                  className="mt-2 h-7 text-[12px]"
                />
                <div className="mt-2 max-h-[calc(100vh-320px)] space-y-1 overflow-y-auto">
                  {hiddenLayers.length === 0 ? (
                    <p className="px-1 text-[11px] text-slate-400">
                      {layerQuery.trim() ? "No unused sources match that search." : "Every collected layer is on."}
                    </p>
                  ) : null}
                  {hiddenLayers.slice(0, 60).map((source) => (
                    <div
                      key={source.id}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setPoolMenu({ x: event.clientX, y: event.clientY, sourceId: source.id });
                      }}
                      className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-slate-50"
                    >
                      <span
                        className="mt-1.5 size-1.5 shrink-0 rounded-full"
                        style={{ background: source.color }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] leading-snug font-medium text-slate-800">
                          {shortSourceName(source.name)}
                        </span>
                        <span className="block truncate text-[10px] text-slate-400">
                          {source.origins[0]?.reason ?? source.kind}
                        </span>
                        <span className="mt-1 flex gap-1">
                          <button
                            type="button"
                            className="card-action"
                            onClick={() => void toggleLayer(source.id, false)}
                          >
                            Subscribe
                          </button>
                          <button
                            type="button"
                            className="card-action"
                            onClick={() => openSourcePreview(source.id)}
                          >
                            Preview
                          </button>
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                {hiddenLayers.length > 60 ? (
                  <p className="mt-1 text-[10px] text-slate-400">
                    Showing 60 of {hiddenLayers.length}. Search to narrow the list.
                  </p>
                ) : null}
                  </>
                ) : (
                  <p className="mt-2 text-[11px] text-slate-400">Collapsed. Click to expand Follow next and unused sources.</p>
                )}
              </div>
            </aside>
          ) : null}
        </div>
      </div>

      <LiveFilterForm
        open={liveFilterOpen}
        initialName={liveFilterSeed.name}
        initialCriteria={liveFilterSeed.criteria}
        onOpenChange={setLiveFilterOpen}
        onSave={saveLiveFilter}
      />
      <FilterTuner
        open={deskEditorOpen}
        onOpenChange={(open) => {
          setDeskEditorOpen(open);
          if (!open) {
            setEditingDesk(null);
            setTunerDraft(null);
          }
        }}
        current={currentFilters}
        editing={editingDesk}
        liveMatchCount={tunerLivePreview?.items ?? null}
        liveStoryCount={tunerLivePreview?.stories ?? null}
        onDraftChange={(filters, view) => setTunerDraft({ filters, view })}
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
      {poolMenu && byId.get(poolMenu.sourceId) ? (
        <SourceContextMenu
          x={poolMenu.x}
          y={poolMenu.y}
          sourceName={byId.get(poolMenu.sourceId)!.name}
          subscribed={Boolean(byId.get(poolMenu.sourceId)?.enabled)}
          onAction={(action) => {
            const id = poolMenu.sourceId;
            if (action.kind === "preview") openSourcePreview(id);
            if (action.kind === "subscribe") void toggleLayer(id, false);
            if (action.kind === "unsubscribe") void toggleLayer(id, true);
            setPoolMenu(null);
          }}
          onClose={() => setPoolMenu(null)}
        />
      ) : null}
      {cardMenu ? (
        <CardContextMenu
          key={`${cardMenu.item.id}:${cardMenu.x}:${cardMenu.y}`}
          x={cardMenu.x}
          y={cardMenu.y}
          title={cardMenu.story?.title ?? cardMenu.item.title}
          currentTopics={cardMenu.item.topics}
          sourceName={byId.get(cardMenu.item.sourceId)?.name ?? null}
          topic={(cardMenu.story ? storyTopicChips(cardMenu.story) : itemTopicChips(cardMenu.item))[0] ?? null}
          place={uniquePlaces(cardMenu.story?.locations ?? cardMenu.item.locations)[0] ?? null}
          read={triage.read.includes(
            cardMenu.story ? `story:${cardMenu.story.id}` : itemKey(cardMenu.item.id),
          )}
          reportTitle={(openReports(reports).find((row) => row.id === openReportId) ?? openReports(reports)[0])?.title ?? null}
          onAction={(action) => void handleCardMenuAction(action)}
          onClose={() => setCardMenu(null)}
        />
      ) : null}
      {chipMenu ? (
        <ContextMenu
          key={`${chipMenu.chip.kind}:${chipMenu.chip.value}:${chipMenu.x}:${chipMenu.y}`}
          x={chipMenu.x}
          y={chipMenu.y}
          title={`${chipMenu.chip.kind}: ${chipMenu.chip.value}`}
          onClose={() => setChipMenu(null)}
          sections={
            chipMenu.chip.kind === "source"
              ? [
                  {
                    items: [
                      { id: "only", label: "Only this layer", onSelect: () => void handleChipMenuAction("only") },
                      { id: "exclude", label: "Exclude from search", hint: "-source:", onSelect: () => void handleChipMenuAction("exclude") },
                      { id: "watch", label: "Watch this layer…", onSelect: () => void handleChipMenuAction("watch") },
                    ],
                  },
                  {
                    items: [
                      { id: "refresh", label: "Refresh now", onSelect: () => void handleChipMenuAction("refresh") },
                      { id: "copy-feed", label: "Copy feed URL", onSelect: () => void handleChipMenuAction("copy-feed") },
                      { id: "mute", label: "Mute layer", danger: true, onSelect: () => void handleChipMenuAction("mute") },
                    ],
                  },
                ]
              : [
                  {
                    items: [
                      { id: "filter", label: `Filter to ${chipMenu.chip.value}`, onSelect: () => void handleChipMenuAction("filter") },
                      {
                        id: "exclude",
                        label: `Exclude ${chipMenu.chip.value}`,
                        hint: `-${chipMenu.chip.kind}:`,
                        onSelect: () => void handleChipMenuAction("exclude"),
                      },
                      { id: "watch", label: "Watch…", onSelect: () => void handleChipMenuAction("watch") },
                    ],
                  },
                ]
          }
        />
      ) : null}
      {notice ? (
        <div className="board-notice no-print" role="status">
          {notice}
        </div>
      ) : null}
      <CommandPalette
        open={paletteOpen}
        mode={paletteMode}
        sources={state.sources}
        places={places.map(([name]) => name)}
        watches={state.watches ?? []}
        customDesks={customDesks}
        savedFilters={paletteSavedFilters}
        briefing={paletteBriefing}
        people={peopleCatalog.map((row) => row.name)}
        unreadOnly={unreadOnly}
        onClose={() => setPaletteOpen(false)}
        onAction={(action) => {
          if (action.kind === "desk") changeDesk(action.desk);
          if (action.kind === "place") focusPlace(action.place);
          if (action.kind === "person") togglePerson(action.name);
          if (action.kind === "source") focusSource(action.sourceId);
          if (action.kind === "search") document.getElementById("board-search")?.focus();
          if (action.kind === "refresh") void refresh();
          if (action.kind === "clear-filters") clearBoardFilters();
          if (action.kind === "toggle-unread") setUnreadOnly((value) => !value);
          if (action.kind === "apply-briefing") void applyMyBriefing(action.profile);
          if (action.kind === "saved-filter") applyFilters(action.filters);
          if (action.kind === "open-reports") changeDesk("reports");
          if (action.kind === "open-user-guide") {
            window.open("/help", "_blank", "noopener,noreferrer");
            setPaletteOpen(false);
            return;
          }
          if (action.kind === "open-saved") {
            setSavedViewsTab(action.tab);
            setSavedViewsOpen(true);
            setPaletteOpen(false);
            return;
          }
          if (action.kind === "help") {
            setPaletteMode("help");
            setPaletteOpen(true);
            return;
          }
          if (action.kind === "watch-current") {
            setSavedViewsTab("watches");
            setSavedViewsOpen(true);
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
      {reportToast ? (
        <ActiveReportToast
          title={reportToast.title}
          storyCount={reportToast.count}
          onOpen={() => {
            openCompiledReport(reportToast.id);
            changeDesk("reports");
            setReportToast(null);
          }}
          onDismiss={() => setReportToast(null)}
        />
      ) : null}
      <SetupMonitoringWizard
        open={setupWizardOpen}
        onOpenChange={setSetupWizardOpen}
        homePlace={homePlace}
        busy={busy}
        onComplete={runSetupMonitoring}
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

const EPSS_STYLE = {
  hot: { background: "#fee2e2", color: "#991b1b" },
  warm: { background: "#fef3c7", color: "#92400e" },
  cool: { background: "#f1f5f9", color: "#475569" },
} as const;

function KevCard({
  entry,
  epss,
  onOpen,
  onVendor,
  onHide,
  onRead,
  read,
}: {
  entry: KevEntry;
  epss?: EpssScore;
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
          {epss ? (
            <Tip text={`FIRST EPSS ${epss.date}: ${(epss.epss * 100).toFixed(2)}% chance of exploitation in 30 days · percentile ${(epss.percentile * 100).toFixed(1)}`}>
              <span className="tag" style={EPSS_STYLE[epssTone(epss)]}>
                {epssLabel(epss)}
              </span>
            </Tip>
          ) : null}
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
