"use client";

import dynamic from "next/dynamic";
import { useRef, useState, type ReactNode } from "react";
import type { Map as LeafletMap } from "leaflet";
import { Expand, Globe2, LocateFixed, Minus, Plus } from "lucide-react";
import { LazyMapGate } from "@/components/monitor/lazy-map-gate";
import { Tip } from "@/components/monitor/tip";
import { leafletCenter, leafletWorld, leafletZoomBy } from "@/lib/map-leaflet-controls";
import type { MapMarker } from "@/lib/geo";

const GeoMapCanvas = dynamic(() => import("./geo-map-canvas"), {
  ssr: false,
  loading: () => <div className="geo-map-skeleton">Loading map…</div>,
});

const LeafletPopout = dynamic(
  () => import("./leaflet-popout").then((mod) => ({ default: mod.LeafletPopout })),
  { ssr: false, loading: () => null },
);

export function TiledMapPanel({
  title,
  hint,
  markers,
  focusId,
  anchor,
  onSelect,
  frameClassName = "",
  lazy = false,
  centerDisabled,
  footer,
}: {
  title: string;
  hint: string;
  markers: MapMarker[];
  focusId?: string | null;
  anchor?: { lat: number; lng: number } | null;
  onSelect?: (name: string, marker?: MapMarker) => void;
  frameClassName?: string;
  /** Defer Leaflet until the frame is near the viewport (Home board). */
  lazy?: boolean;
  centerDisabled?: boolean;
  footer?: ReactNode;
}) {
  const [popout, setPopout] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);

  const map = (
    <GeoMapCanvas
      markers={markers}
      focusId={focusId}
      interactive
      onSelect={onSelect}
      mapRef={mapRef}
      anchor={anchor}
    />
  );

  return (
    <>
      <div className="map-toolbar">
        <div className="min-w-0">
          <div className="map-toolbar-title text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            {title}
          </div>
          <p className="truncate text-[11px] text-slate-500">{hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Tip text="Zoom in">
            <button type="button" className="map-tool" onClick={() => leafletZoomBy(mapRef.current, 1)}>
              <Plus className="size-3.5" />
            </button>
          </Tip>
          <Tip text="Zoom out">
            <button type="button" className="map-tool" onClick={() => leafletZoomBy(mapRef.current, -1)}>
              <Minus className="size-3.5" />
            </button>
          </Tip>
          <Tip text="Fit view">
            <button
              type="button"
              className="map-tool"
              disabled={centerDisabled}
              onClick={() => leafletCenter(mapRef.current, markers, focusId, anchor)}
            >
              <LocateFixed className="size-3.5" />
            </button>
          </Tip>
          <Tip text="World view">
            <button type="button" className="map-tool" onClick={() => leafletWorld(mapRef.current)}>
              <Globe2 className="size-3.5" />
            </button>
          </Tip>
          <Tip text="Expand map">
            <button type="button" className="map-tool" onClick={() => setPopout(true)}>
              <Expand className="size-3.5" />
            </button>
          </Tip>
        </div>
      </div>
      <div className={`geo-map-frame min-h-0 h-full min-h-[120px] ${frameClassName}`.trim()}>
        {lazy ? <LazyMapGate placeholder="Map loads when visible…">{map}</LazyMapGate> : map}
      </div>
      {footer}
      {popout ? (
        <LeafletPopout
          title={title}
          markers={markers}
          focusId={focusId}
          anchor={anchor}
          onSelect={onSelect}
          onClose={() => setPopout(false)}
        />
      ) : null}
    </>
  );
}
