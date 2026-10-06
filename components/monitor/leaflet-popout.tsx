"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import { Globe2, LocateFixed, Minus, Plus, X } from "lucide-react";
import { Tip } from "@/components/monitor/tip";
import type { MapMarker } from "@/lib/geo";

const GeoMapCanvas = dynamic(() => import("./geo-map-canvas"), {
  ssr: false,
  loading: () => <div className="geo-map-skeleton">Loading map…</div>,
});

export function LeafletPopout({
  title,
  markers,
  focusId,
  anchor,
  onSelect,
  onClose,
}: {
  title: string;
  markers: MapMarker[];
  focusId?: string | null;
  anchor?: { lat: number; lng: number } | null;
  onSelect?: (name: string, marker?: MapMarker) => void;
  onClose: () => void;
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
    <div className="map-popout" role="dialog" aria-label={`${title} popped out`}>
      <div className="map-popout-panel">
        <div className="map-toolbar">
          <div className="text-[12px] font-semibold text-slate-800">{title}</div>
          <div className="flex items-center gap-1">
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
            <button type="button" className="map-tool" onClick={onClose}>
              <X className="size-3.5" />
            </button>
          </div>
        </div>
        <div className="geo-map-frame min-h-0 flex-1">
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
    </div>
  );
}
