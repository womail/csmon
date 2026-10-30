"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronDown,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import { DeskTabs } from "@/components/monitor/nav";
import { OptionsButton } from "@/components/monitor/options-panel";
import { GdeltButton } from "@/components/monitor/gdelt-panel";
import { AcledButton } from "@/components/monitor/acled-panel";
import { RedditButton } from "@/components/monitor/reddit-panel";
import { SavedViewsButton } from "@/components/monitor/saved-views-panel";
import { ThemeToggle } from "@/components/monitor/theme-toggle";
import { QueryBuilderButton } from "@/components/monitor/query-builder";
import { Tip } from "@/components/monitor/tip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BoardFilters } from "@/lib/board-state";
import { BOARD_SORT_LABEL, type BoardSort } from "@/lib/board-sort";
import type { MyBriefingProfile } from "@/lib/briefing-profile";
import type { GdeltQuery } from "@/lib/gdelt";
import type { AcledProfile } from "@/lib/acled";
import type { Desk, MonitorState, TimeRange, Watchlist } from "@/lib/types";
import type { UserDesk } from "@/lib/user-desks";
import type { QueryTree } from "@/lib/query-builder";
import type { UserOptions } from "@/lib/options";
import { applySuggestion, searchSuggestions, type SearchSuggestData } from "@/lib/search-suggest";

function BoardSearch({
  query,
  onQueryChange,
  placeholder,
  data,
  onQuerySubmit,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder: string;
  data: SearchSuggestData;
  /** Enter with no suggestion open: typed tokens become Active chips. */
  onQuerySubmit?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const suggestions = useMemo(() => searchSuggestions(query, data), [data, query]);
  const open = focused && suggestions.length > 0 && dismissed !== query;
  const activeIndex = Math.min(active, Math.max(0, suggestions.length - 1));

  function pick(index: number) {
    const row = suggestions[index];
    if (!row) return;
    onQueryChange(applySuggestion(query, row));
    setActive(0);
  }

  return (
    <div className="relative min-w-[100px] flex-1">
      <Search className="pointer-events-none absolute top-1 left-1.5 size-3 text-muted-foreground" />
      <Input
        id="board-search"
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setActive(0);
          setDismissed(null);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (!open) {
            if (e.key === "Enter" && onQuerySubmit) {
              e.preventDefault();
              onQuerySubmit();
            }
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((activeIndex + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((activeIndex - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === "Tab" || e.key === "Enter") {
            e.preventDefault();
            pick(activeIndex);
          } else if (e.key === "Escape") {
            e.stopPropagation();
            setDismissed(query);
          }
        }}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls="board-search-suggest"
        aria-autocomplete="list"
        className="board-search-input h-7 border-border bg-background pl-6 text-[11px]"
      />
      {open ? (
        <ul id="board-search-suggest" role="listbox" className="search-suggest">
          {suggestions.map((row, index) => (
            <li
              key={`${row.insert}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className="search-suggest-row"
              data-active={index === activeIndex ? "true" : "false"}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(index);
              }}
              onMouseEnter={() => setActive(index)}
            >
              <span className="truncate">{row.label}</span>
              {row.hint ? <span className="search-suggest-hint">{row.hint}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function MonitorToolbar({
  viewDesk,
  query,
  onQueryChange,
  desk,
  onDeskChange,
  customDesks,
  onCreateFilter,
  range,
  onRangeChange,
  ranges,
  boardSort,
  onBoardSortChange,
  refreshing,
  busy,
  onRefresh,
  onLoadKev,
  onTune,
  onHome,
  watchLine,
  currentFilters,
  onApplyFilters,
  onApplyBriefing,
  enabledSourceKeys,
  qb,
  onQbChange,
  watches,
  onWatchesChange,
  onOpenWatch,
  savedViewsOpen,
  onSavedViewsOpenChange,
  savedViewsTab,
  subreddits,
  redditOpen,
  onRedditOpenChange,
  onSubredditsChange,
  onLoadReddit,
  onImportGdelt,
  onGdeltListChange,
  onLoadGdelt,
  onAcledListChange,
  onLoadAcled,
  onOptionsApply,
  onSourcesApplied,
  onAddRss,
  searchData,
  onQuerySubmit,
}: {
  viewDesk: string;
  query: string;
  onQueryChange: (value: string) => void;
  desk: Desk;
  onDeskChange: (desk: Desk) => void;
  customDesks: UserDesk[];
  onCreateFilter?: () => void;
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  ranges: TimeRange[];
  boardSort: BoardSort;
  onBoardSortChange: (sort: BoardSort) => void;
  refreshing: boolean;
  busy: boolean;
  onRefresh: () => void;
  onLoadKev: () => void;
  onTune: () => void;
  onHome: () => void;
  watchLine: string;
  currentFilters: BoardFilters;
  onApplyFilters: (filters: BoardFilters) => void;
  onApplyBriefing: (profile: MyBriefingProfile) => void | Promise<void>;
  enabledSourceKeys: string[];
  qb: QueryTree;
  onQbChange: (tree: QueryTree) => void;
  watches: Watchlist[];
  onWatchesChange: (watches: Watchlist[]) => void;
  onOpenWatch: (watch: Watchlist) => void;
  savedViewsOpen: boolean;
  onSavedViewsOpenChange: (open: boolean) => void;
  savedViewsTab: "filters" | "briefing" | "watches";
  subreddits: string[];
  redditOpen: boolean;
  onRedditOpenChange: (open: boolean) => void;
  onSubredditsChange: (subs: string[]) => void;
  onLoadReddit: (subs: string[]) => void;
  onImportGdelt: (subs: string[]) => void;
  onGdeltListChange: (queries: GdeltQuery[]) => void;
  onLoadGdelt: (queries: GdeltQuery[]) => void;
  onAcledListChange: (profiles: AcledProfile[]) => void;
  onLoadAcled: (profiles: AcledProfile[]) => void;
  onOptionsApply: (options: UserOptions) => void;
  onSourcesApplied: (state: MonitorState) => void;
  onAddRss: () => void;
  searchData: SearchSuggestData;
  onQuerySubmit?: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="monitor-toolbar border-b border-border bg-card/80">
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">
        <Tip text="Home dashboard">
          <button type="button" onClick={onHome} className="flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted">
            <div className="grid size-6 place-items-center rounded-md bg-orange-500 text-[10px] font-bold text-white">
              cs
            </div>
          </button>
        </Tip>
        <BoardSearch
          query={query}
          onQueryChange={onQueryChange}
          placeholder={viewDesk === "patch" ? "Search CVE, vendor, product…" : "Search… (try source:cisa or place:Ireland)"}
          data={searchData}
          onQuerySubmit={onQuerySubmit}
        />
        <div className="toolbar-group">
          <SavedViewsButton
            current={currentFilters}
            onApplyFilters={onApplyFilters}
            watchLine={watchLine}
            desk={desk}
            watches={watches}
            onWatchesChange={onWatchesChange}
            onOpenWatch={onOpenWatch}
            enabledSourceKeys={enabledSourceKeys}
            onApplyBriefing={onApplyBriefing}
            open={savedViewsOpen}
            onOpenChange={onSavedViewsOpenChange}
            initialTab={savedViewsTab}
          />
          <QueryBuilderButton value={qb} onChange={onQbChange} />
          <Tip text="Tune filters and save as a desk">
            <Button size="xs" variant="outline" onClick={onTune}>
              <SlidersHorizontal className="size-3" />
              Tune
            </Button>
          </Tip>
          <Tip text="Illustrated user guide with screenshots">
            <Button size="xs" variant="outline" asChild>
              <Link href="/help" target="_blank" rel="noopener noreferrer">
                <BookOpen className="size-3" />
                Help
              </Link>
            </Button>
          </Tip>
        </div>
        <div className="toolbar-segment hidden sm:flex">
          {ranges.map((r) => (
            <button
              key={r}
              type="button"
              data-active={range === r ? "true" : "false"}
              onClick={() => onRangeChange(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <label className="toolbar-sort hidden md:flex">
          Sort
          <select
            value={boardSort}
            onChange={(e) => onBoardSortChange(e.target.value as BoardSort)}
            aria-label="Board sort"
          >
            {(Object.keys(BOARD_SORT_LABEL) as BoardSort[]).map((key) => (
              <option key={key} value={key}>
                {BOARD_SORT_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
        <div className="relative ml-auto flex items-center gap-1">
          <Tip text="Re-fetch enabled layers">
            <Button size="xs" variant="outline" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={refreshing ? "animate-spin" : ""} />
              <span className="hidden lg:inline">Refresh</span>
            </Button>
          </Tip>
          <div className="relative">
            <Button size="xs" variant="outline" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}>
              <MoreHorizontal className="size-3.5" />
              <span className="hidden sm:inline">More</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
            {moreOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  aria-label="Close menu"
                  onClick={() => setMoreOpen(false)}
                />
                <div className="absolute right-0 top-full z-50 mt-1 flex w-52 flex-col gap-0.5 rounded-md border border-border bg-popover p-1 shadow-md">
                  <Button size="xs" variant="ghost" className="justify-start" onClick={() => { onLoadKev(); setMoreOpen(false); }} disabled={busy}>
                    <Shield className="size-3" /> KEV
                  </Button>
                  <Button size="xs" variant="ghost" className="justify-start" onClick={() => { onAddRss(); setMoreOpen(false); }}>
                    <Plus className="size-3" /> Add RSS
                  </Button>
                  <div className="my-0.5 border-t border-border" />
                  <div className="flex flex-wrap gap-1 px-1 pb-1">
                    <GdeltButton busy={busy} onListChange={onGdeltListChange} onLoad={(q) => { void onLoadGdelt(q); setMoreOpen(false); }} />
                    <AcledButton busy={busy} onListChange={onAcledListChange} onLoad={(p) => { void onLoadAcled(p); setMoreOpen(false); }} />
                    <RedditButton
                      busy={busy}
                      open={redditOpen}
                      onOpenChange={onRedditOpenChange}
                      onListChange={onSubredditsChange}
                      onLoad={onLoadReddit}
                      onImportGdelt={onImportGdelt}
                    />
                  </div>
                  <div className="my-0.5 border-t border-border" />
                  <div className="flex items-center justify-between px-1">
                    <ThemeToggle />
                    <OptionsButton onSourcesApplied={onSourcesApplied} onApply={onOptionsApply} />
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
        <div className="w-full rounded-md border border-border bg-background p-0.5 lg:hidden">
          <DeskTabs
            desk={desk}
            onChange={onDeskChange}
            customDesks={customDesks}
            onCreateFilter={onCreateFilter}
          />
        </div>
      </div>
    </div>
  );
}
