"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Expand, Globe2, LocateFixed, Minus, Plus } from "lucide-react";
import { FastPlaceMap, fitFastMapView, type FastMapView } from "@/components/monitor/fast-place-map";
import { ResizablePanel } from "@/components/monitor/resizable-panel";
import { Tip } from "@/components/monitor/tip";
import { KIND_COLOR } from "@/components/monitor/map-colors";
import type { MapMarker } from "@/lib/geo";

const LeafletPopout = dynamic(
  () => import("./leaflet-popout").then((mod) => ({ default: mod.LeafletPopout })),
  { ssr: false, loading: () => null },
);

export function SituationMap({
  title,
  markers,
  onSelect,
  empty = "No mapped places in this view.",
  resizeKey = "csmon.map-height.situation",
}: {
  title: string;
  markers: MapMarker[];
  onSelect?: (name: string, marker?: MapMarker) => void;
  empty?: string;
  resizeKey?: string;
}) {
  const [popout, setPopout] = useState(false);
  const [mounted, setMounted] = useState(false);
  const markerKey = useMemo(
    () => markers.map((m) => `${m.id}:${m.lat.toFixed(2)},${m.lng.toFixed(2)}`).join("|"),
    [markers],
  );
  const [view, setView] = useState<FastMapView>(() => fitFastMapView(markers));

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) setMounted(true);
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }
    const id = window.setTimeout(run, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    setView(fitFastMapView(markers));
  }, [markerKey, markers]);

  function zoomBy(delta: number) {
    setView((v) => ({ ...v, zoom: Math.min(6, Math.max(-1, v.zoom + delta)) }));
  }

  function world() {
    setView({ lat: 22, lng: 10, zoom: 0 });
  }

  function center() {
    if (!markers.length) return world();
    setView(fitFastMapView(markers));
  }

  return (
    <div className="map-panel-root card-tile overflow-hidden p-0">
      <ResizablePanel storageKey={resizeKey} defaultHeight={240} minHeight={160} maxHeight={480}>
        <div className="map-panel">
          <div className="map-toolbar">
            <div className="min-w-0">
              <div className="map-toolbar-title text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                {title}
              </div>
              <p className="truncate text-[11px] text-slate-500">
                {markers.length
                  ? `${markers.length} mapped · fast preview · pop out for tiles`
                  : empty}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Tip text="Zoom in">
                <button type="button" className="map-tool" onClick={() => zoomBy(0.5)}>
                  <Plus className="size-3.5" />
                </button>
              </Tip>
              <Tip text="Zoom out">
                <button type="button" className="map-tool" onClick={() => zoomBy(-0.5)}>
                  <Minus className="size-3.5" />
                </button>
              </Tip>
              <Tip text="Fit markers">
                <button type="button" className="map-tool" onClick={center} disabled={!markers.length}>
                  <LocateFixed className="size-3.5" />
                </button>
              </Tip>
              <Tip text="Reset view">
                <button type="button" className="map-tool" onClick={world}>
                  <Globe2 className="size-3.5" />
                </button>
              </Tip>
              <Tip text="Low-res tile map (loads on demand)">
                <button type="button" className="map-tool" onClick={() => setPopout(true)}>
                  <Expand className="size-3.5" />
                </button>
              </Tip>
            </div>
          </div>
          <div className="geo-map-frame min-h-0 h-full min-h-[120px]">
            {mounted ? (
              <FastPlaceMap
                markers={markers}
                view={view}
                onViewChange={setView}
                onSelect={onSelect}
                interactive
              />
            ) : (
              <div className="geo-map-skeleton">Map…</div>
            )}
          </div>
        </div>
      </ResizablePanel>
      {markers.length > 0 ? (
        <div className="flex flex-wrap gap-1 border-t border-slate-100 px-2 py-2">
          {markers.slice(0, 8).map((marker) => (
            <button
              key={marker.id}
              type="button"
              className="tag"
              style={{ background: "#ecfeff", color: KIND_COLOR[marker.kind] }}
              title={marker.hint ?? `Filter to ${marker.name}`}
              onClick={() => onSelect?.(marker.name, marker)}
            >
              {marker.name}
              {marker.count ? ` ${marker.count}` : ""}
            </button>
          ))}
        </div>
      ) : null}
      {popout ? (
        <LeafletPopout
          title={title}
          markers={markers}
          onSelect={onSelect}
          onClose={() => setPopout(false)}
        />
      ) : null}
    </div>
  );
}
