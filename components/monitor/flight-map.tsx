"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import { Globe2, LocateFixed, Minus, Plus } from "lucide-react";
import { Tip } from "@/components/monitor/tip";
import type { MapMarker } from "@/lib/geo";

const GeoMapCanvas = dynamic(() => import("./geo-map-canvas"), {
  ssr: false,
  loading: () => <div className="geo-map-skeleton">Loading map…</div>,
});

export function FlightMap({
  markers,
  focusId,
  onSelect,
  anchor,
}: {
  markers: MapMarker[];
  focusId?: string | null;
  onSelect?: (name: string, marker?: MapMarker) => void;
  anchor?: { lat: number; lng: number } | null;
}) {
  const mapRef = useRef<LeafletMap | null>(null);

  function zoomBy(delta: number) {
    const map = mapRef.current;
    if (!map) return;
    if (delta > 0) map.zoomIn();
    else map.zoomOut();
  }

  function world() {
    mapRef.current?.setView([20, 12], 2, { animate: false });
  }

  function center() {
    const map = mapRef.current;
    const focus = markers.find((row) => row.id === focusId);
    if (!map) return;
    if (focus) map.setView([focus.lat, focus.lng], Math.max(map.getZoom(), 4), { animate: false });
    else if (anchor) map.setView([anchor.lat, anchor.lng], 4, { animate: false });
    else world();
  }

  return (
    <div className="map-panel">
      <div className="map-toolbar">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Live tracks</div>
          <p className="truncate text-[11px] text-slate-500">
            {markers.length ? `${markers.length} airborne` : "No airborne tracks yet."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Tip text="Zoom in">
            <button type="button" className="map-tool" onClick={() => zoomBy(1)}>
              <Plus className="size-3.5" />
            </button>
          </Tip>
          <Tip text="Zoom out">
            <button type="button" className="map-tool" onClick={() => zoomBy(-1)}>
              <Minus className="size-3.5" />
            </button>
          </Tip>
          <Tip text="Center">
            <button type="button" className="map-tool" onClick={center}>
              <LocateFixed className="size-3.5" />
            </button>
          </Tip>
          <Tip text="World">
            <button type="button" className="map-tool" onClick={world}>
              <Globe2 className="size-3.5" />
            </button>
          </Tip>
        </div>
      </div>
      <div className="geo-map-frame min-h-[420px] flex-1">
        <GeoMapCanvas
          markers={markers}
          focusId={focusId}
          interactive
          onSelect={onSelect}
          mapRef={mapRef}
          anchor={anchor}
        />
      </div>
    </div>
  );
}
