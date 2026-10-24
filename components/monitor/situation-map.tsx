"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ResizablePanel } from "@/components/monitor/resizable-panel";
import { TiledMapPanel } from "@/components/monitor/tiled-map-panel";
import { KIND_COLOR } from "@/components/monitor/map-colors";
import { MapDrawers } from "@/components/monitor/map-drawers";
import { MapLaneBar, MapScrubber } from "@/components/monitor/map-tools";
import type { Story } from "@/lib/cluster";
import type { MapMarker } from "@/lib/geo";
import { parseMapCamera, writeMapCamera, type MapCamera } from "@/lib/map-camera";
import {
  buildSituationBrief,
  sameFrame,
  storiesInFrame,
  type BriefRising,
  type BriefWatch,
  type MapFrame,
} from "@/lib/situation-brief";
import { rangeStart } from "@/lib/time";
import type { Source, TimeRange } from "@/lib/types";

export function SituationMap({
  title,
  markers,
  stories,
  onSelect,
  onOpenStory,
  onCategory,
  topic = null,
  range,
  briefContext,
  onStartReport,
  onOpenWatch,
  empty = "No mapped places in this view.",
  resizeKey = "csmon.map-height.situation",
  lazy = true,
}: {
  title: string;
  markers: MapMarker[];
  stories?: Story[];
  onSelect?: (name: string, marker?: MapMarker) => void;
  onOpenStory?: (storyId: string) => void;
  onCategory?: (topic: string | null) => void;
  topic?: string | null;
  range?: TimeRange;
  briefContext?: {
    rising: BriefRising[];
    watches: BriefWatch[];
    hypotheses: string[];
    hypothesisName?: string | null;
    desks: string[];
    sources: Map<number, Source>;
  };
  onStartReport?: (stories: Story[]) => void;
  onOpenWatch?: (watch: BriefWatch) => void;
  empty?: string;
  resizeKey?: string;
  lazy?: boolean;
}) {
  const [pinnedIds, setPinnedIds] = useState<string[] | null>(null);
  const [heat, setHeat] = useState(false);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [frame, setFrame] = useState<MapFrame | null>(null);
  const onFrame = useCallback((next: MapFrame) => {
    setFrame((current) => (current && sameFrame(current, next) ? current : next));
  }, []);
  const camera = useMemo(
    () => (typeof window === "undefined" ? null : parseMapCamera(window.location.search)),
    [],
  );
  const cameraTimer = useRef<number | null>(null);
  const onCamera = useCallback((next: MapCamera) => {
    if (cameraTimer.current) window.clearTimeout(cameraTimer.current);
    cameraTimer.current = window.setTimeout(() => writeMapCamera(next), 350);
  }, []);
  useEffect(
    () => () => {
      if (cameraTimer.current) window.clearTimeout(cameraTimer.current);
    },
    [],
  );

  const bounds = useMemo(() => {
    const times = [
      ...(stories ?? []).map((story) => story.latestAt),
      ...markers.map((marker) => marker.at ?? Number.NaN),
    ].filter((time) => Number.isFinite(time));
    const ranged = range && range !== "all" ? rangeStart(range) : null;
    const dataMin = times.length ? Math.min(...times) : Date.now() - 60 * 60 * 1000;
    const dataMax = times.length ? Math.max(...times) : Date.now();
    const start = ranged ?? dataMin;
    return { start, end: Math.max(dataMax, start + 1000) };
  }, [markers, range, stories]);

  const inWindow = useCallback(
    (time: number | undefined) => {
      if (time == null || playhead == null) return true;
      return time >= bounds.start && time <= playhead;
    },
    [bounds.start, playhead],
  );
  const shownMarkers = useMemo(
    () => markers.filter((marker) => inWindow(marker.at)),
    [inWindow, markers],
  );
  const shownStories = useMemo(
    () => storiesInFrame((stories ?? []).filter((story) => inWindow(story.latestAt)), frame),
    [frame, inWindow, stories],
  );
  const brief = useMemo(() => {
    if (!briefContext) return null;
    return buildSituationBrief({
      stories: shownStories,
      rising: briefContext.rising,
      watches: briefContext.watches,
      hypotheses: briefContext.hypotheses,
      hypothesisName: briefContext.hypothesisName,
      desks: briefContext.desks,
      sources: briefContext.sources,
    });
  }, [briefContext, shownStories]);
  const placeChips = useMemo(() => {
    const counts = new Map<string, { name: string; count: number; kind: MapMarker["kind"]; marker: MapMarker }>();
    for (const marker of shownMarkers) {
      if (marker.kind === "flight") continue;
      const row = counts.get(marker.name);
      if (row) row.count += marker.count ?? 1;
      else counts.set(marker.name, { name: marker.name, count: marker.count ?? 1, kind: marker.kind, marker });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }, [shownMarkers]);
  const tools = Boolean(stories && stories.length > 0);
  const hint = shownMarkers.length
    ? `${shownMarkers.length} mapped · counts split as you zoom · OpenStreetMap`
    : empty;
  const overlay = tools ? (
    <>
      <MapDrawers
        stories={shownStories}
        pinnedIds={pinnedIds}
        onClearPin={() => setPinnedIds(null)}
        onOpenStory={onOpenStory}
        brief={brief}
        onSelectPlace={(name) => onSelect?.(name)}
        onOpenWatch={onOpenWatch}
        onStartReport={
          onStartReport && brief && brief.stories.length
            ? () => {
                const ranked = brief.stories
                  .map((row) => shownStories.find((story) => story.id === row.id))
                  .filter((story): story is Story => Boolean(story));
                if (ranked.length) onStartReport(ranked);
              }
            : undefined
        }
      />
      {onCategory ? <MapLaneBar topic={topic} onCategory={onCategory} /> : null}
    </>
  ) : null;

  return (
    <div className="map-panel-root card-tile overflow-hidden p-0">
      <ResizablePanel storageKey={resizeKey} defaultHeight={280} minHeight={180} maxHeight={520}>
        <div className="map-panel">
          <TiledMapPanel
            title={title}
            hint={hint}
            markers={shownMarkers}
            onSelect={onSelect}
            onOpenStory={onOpenStory}
            onInspect={(members) => {
              const ids = members.map((marker) => marker.storyId).filter((id): id is string => Boolean(id));
              setPinnedIds(ids.length ? ids : null);
            }}
            overlay={overlay}
            camera={camera}
            onCamera={tools ? onCamera : undefined}
            onFrame={tools ? onFrame : undefined}
            heat={heat}
            onToggleHeat={tools ? () => setHeat((current) => !current) : undefined}
            lazy={lazy}
            centerDisabled={!shownMarkers.length}
          />
        </div>
      </ResizablePanel>
      {tools ? (
        <MapScrubber
          start={bounds.start}
          end={bounds.end}
          resetKey={`${topic ?? ""}:${range ?? ""}`}
          onPlayhead={setPlayhead}
        />
      ) : null}
      {placeChips.length > 0 ? (
        <div className="flex flex-wrap gap-1 border-t border-slate-100 px-2 py-2">
          {placeChips.map((chip) => (
            <button
              key={chip.name}
              type="button"
              className="tag"
              style={{ background: "#ecfeff", color: KIND_COLOR[chip.kind] }}
              title={`Filter to ${chip.name}`}
              onClick={() => onSelect?.(chip.name, chip.marker)}
            >
              {chip.name} {chip.count}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
