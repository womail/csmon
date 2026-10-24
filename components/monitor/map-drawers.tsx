"use client";

import { useEffect, useMemo, useState } from "react";
import type { Story } from "@/lib/cluster";
import { coordsForPlace } from "@/lib/geo";
import { independentSourceCount } from "@/lib/syndication";

function hourBuckets(stories: Story[]) {
  if (!stories.length) return [];
  const times = stories.map((story) => story.latestAt);
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = Math.max(max - min, 60 * 60 * 1000);
  const byDay = span > 36 * 60 * 60 * 1000;
  const n = byDay ? 6 : 8;
  const size = span / n;
  const counts = Array.from({ length: n }, () => 0);
  for (const time of times) {
    const index = Math.min(n - 1, Math.max(0, Math.floor((time - min) / size)));
    counts[index] += 1;
  }
  return counts.map((value, index) => ({
    label: new Date(min + index * size).toLocaleString(undefined, byDay
      ? { month: "short", day: "numeric" }
      : { hour: "numeric" }),
    value,
  }));
}

function tally(stories: Story[], pick: (story: Story) => string[]) {
  const counts = new Map<string, number>();
  for (const story of stories) {
    for (const name of pick(story)) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
}

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="map-stat-bars">
      {rows.map((row) => (
        <div key={row.label} className="map-stat-row">
          <span className="map-stat-label">{row.label}</span>
          <span className="map-stat-track">
            <span className="map-stat-fill" style={{ width: `${Math.round((row.value / max) * 100)}%` }} />
          </span>
          <span className="map-stat-value">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function MapDrawers({
  stories,
  pinnedIds,
  onClearPin,
  onOpenStory,
}: {
  stories: Story[];
  pinnedIds: string[] | null;
  onClearPin: () => void;
  onOpenStory?: (storyId: string) => void;
}) {
  const [drawer, setDrawer] = useState<"feed" | "stats" | null>(null);
  useEffect(() => {
    if (pinnedIds) setDrawer("feed");
  }, [pinnedIds]);
  const mapped = useMemo(
    () => stories.filter((story) => story.locations.some((name) => coordsForPlace(name))),
    [stories],
  );
  const shown = useMemo(() => {
    if (!pinnedIds) return mapped;
    const ids = new Set(pinnedIds);
    return mapped.filter((story) => ids.has(story.id));
  }, [mapped, pinnedIds]);
  const topics = useMemo(() => tally(shown, (story) => story.topics.slice(0, 2)), [shown]);
  const places = useMemo(
    () => tally(shown, (story) => story.locations.filter((name) => coordsForPlace(name)).slice(0, 1)),
    [shown],
  );
  const hours = useMemo(() => hourBuckets(shown), [shown]);

  return (
    <div className="map-overlay">
      <div className="map-overlay-tabs">
        <button
          type="button"
          className={`map-overlay-tab ${drawer === "feed" ? "is-active" : ""}`}
          onClick={() => setDrawer((current) => (current === "feed" ? null : "feed"))}
        >
          Feed
        </button>
        <button
          type="button"
          className={`map-overlay-tab ${drawer === "stats" ? "is-active" : ""}`}
          onClick={() => setDrawer((current) => (current === "stats" ? null : "stats"))}
        >
          Stats
        </button>
      </div>
      {drawer === "feed" ? (
        <div className="map-drawer" role="region" aria-label="Stories on this map">
          <div className="map-drawer-head">
            <span>{pinnedIds ? "This cluster" : "On this map"}</span>
            <span className="text-slate-400">{shown.length}</span>
            {pinnedIds ? (
              <button type="button" className="map-overlay-tab" onClick={onClearPin}>
                All
              </button>
            ) : null}
          </div>
          <div className="map-drawer-body">
            {shown.slice(0, 40).map((story) => {
              const sources = independentSourceCount(story.items);
              return (
                <button
                  key={story.id}
                  type="button"
                  className="map-feed-row"
                  onClick={() => onOpenStory?.(story.id)}
                >
                  <span className="map-feed-title">{story.title}</span>
                  <span className="map-feed-meta">
                    {story.locations.find((name) => coordsForPlace(name)) ?? story.locations[0] ?? "Unplaced"}
                    {" · "}
                    {sources} {sources === 1 ? "source" : "sources"}
                  </span>
                </button>
              );
            })}
            {shown.length === 0 ? <p className="map-drawer-empty">Nothing on the map in this view.</p> : null}
          </div>
        </div>
      ) : null}
      {drawer === "stats" ? (
        <div className="map-drawer" role="region" aria-label="Map statistics">
          <div className="map-drawer-head">
            <span>On this map</span>
            <span className="text-slate-400">{shown.length}</span>
          </div>
          <div className="map-drawer-body map-drawer-stats">
            <div>
              <div className="map-stat-title">By topic</div>
              <Bars rows={topics.map(([label, value]) => ({ label, value }))} />
            </div>
            <div>
              <div className="map-stat-title">Places</div>
              <Bars rows={places.map(([label, value]) => ({ label, value }))} />
            </div>
            <div>
              <div className="map-stat-title">When</div>
              <Bars rows={hours} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
