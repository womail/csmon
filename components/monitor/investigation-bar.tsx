"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, X } from "lucide-react";
import { Tip } from "@/components/monitor/tip";
import { boardQueryString, type BoardFilters } from "@/lib/board-state";
import { retainMapCamera } from "@/lib/map-camera";
import { activeFilterCount, deskLabel, filterSummaryLine } from "@/lib/investigation-summary";
import type { Desk, Source, TimeRange } from "@/lib/types";

export function InvestigationBar({
  desk,
  deskTitle,
  range,
  filters,
  filterTopics,
  filterTags,
  displayOnly,
  viewDesk,
  unreadCount,
  unreadOnly,
  onUnreadOnlyChange,
  activeReportTitle,
  activeReportStories,
  onClearFilters,
  onOpenActiveReport,
  filtersActive,
  contextLine,
  coverageLine,
  sources,
  trail,
}: {
  desk: Desk;
  deskTitle?: string;
  range: TimeRange;
  filters: BoardFilters;
  filterTopics: string[];
  filterTags: string[];
  displayOnly: boolean;
  viewDesk: string;
  unreadCount: number;
  unreadOnly: boolean;
  onUnreadOnlyChange: (value: boolean) => void;
  activeReportTitle: string | null;
  activeReportStories: number;
  onClearFilters: () => void;
  onOpenActiveReport?: () => void;
  filtersActive: boolean;
  contextLine?: string;
  coverageLine?: string;
  sources?: Map<number, Source>;
  /** Trail ◀ ▶ controls (task 11). */
  trail?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const filterCount = activeFilterCount(filters, {
    filterTopics,
    filterTags,
    displayOnly,
    viewDesk,
  });
  const title = deskTitle ?? deskLabel(desk);
  const summary = filterSummaryLine(filters, sources);

  async function copyLink() {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(boardQueryString(filters));
    retainMapCamera(params);
    const qs = params.toString();
    const url = `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="investigation-bar">
      <div className="investigation-bar-inner">
        <div className="investigation-bar-context">
          <span className="investigation-bar-desk">{title}</span>
          <span className="investigation-bar-meta">
            <span>{range}</span>
            {coverageLine ? (
              <>
                <span className="investigation-bar-sep" aria-hidden>
                  ·
                </span>
                <span className="investigation-bar-summary" title="Stories with a mapped place, enabled sources fetched in the last 6 hours, and items with no geocoded place">
                  {coverageLine}
                </span>
              </>
            ) : null}
            {filterCount > 0 ? (
              <>
                <span className="investigation-bar-sep" aria-hidden>
                  ·
                </span>
                <span className="investigation-bar-filter-count">
                  {filterCount} filter{filterCount === 1 ? "" : "s"}
                </span>
                {summary ? (
                  <span className="investigation-bar-summary" title={summary}>
                    {summary}
                  </span>
                ) : null}
              </>
            ) : null}
          </span>
        </div>

        <div className="investigation-bar-aside">
          {(unreadCount > 0 || activeReportTitle) && (
            <div className="investigation-bar-status" aria-label="Board status">
              {unreadCount > 0 ? (
                <span className="inv-stat inv-stat-unread">
                  <span className="inv-stat-value">{unreadCount}</span>
                  <span className="inv-stat-label">unread</span>
                </span>
              ) : null}
              {activeReportTitle ? (
                <Tip text="Open this briefing on the Reports desk">
                  <button type="button" className="inv-stat inv-stat-report" onClick={() => onOpenActiveReport?.()}>
                    <span className="inv-stat-label">Report</span>
                    <span className="inv-stat-value truncate max-w-[8rem]">{activeReportTitle}</span>
                    {activeReportStories > 0 ? (
                      <span className="inv-stat-count">({activeReportStories})</span>
                    ) : null}
                  </button>
                </Tip>
              ) : null}
            </div>
          )}

          <div className="investigation-bar-actions">
            {trail}
            <Tip text={unreadOnly ? "Show all items" : "Show only stories you have not marked read"}>
              <button
                type="button"
                className={`investigation-bar-btn ${unreadOnly ? "is-active" : ""}`}
                onClick={() => onUnreadOnlyChange(!unreadOnly)}
              >
                Unread only
              </button>
            </Tip>
            <Tip text={copied ? "Copied" : "Copy link to this view"}>
              <button type="button" className="investigation-bar-btn" onClick={() => void copyLink()}>
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                Link
              </button>
            </Tip>
            {filtersActive ? (
              <Tip text="Clear all filters on this desk">
                <button type="button" className="investigation-bar-btn investigation-bar-btn-muted" onClick={onClearFilters}>
                  <X className="size-3" />
                  Clear
                </button>
              </Tip>
            ) : null}
          </div>
        </div>
      </div>
      {contextLine ? <p className="investigation-bar-hint">{contextLine}</p> : null}
    </div>
  );
}
