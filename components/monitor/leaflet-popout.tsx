"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import { Globe2, LocateFixed, Minus, Plus, X } from "lucide-react";
import { Tip } from "@/components/monitor/tip";
import { leafletCenter, leafletWorld, leafletZoomBy } from "@/lib/map-leaflet-controls";
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

  return (
    <div className="map-popout" role="dialog" aria-label={`${title} popped out`}>
      <div className="map-popout-panel">
        <div className="map-toolbar">
          <div className="text-[12px] font-semibold text-slate-800">{title}</div>
          <div className="flex items-center gap-1">
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
            <Tip text="Center">
              <button
                type="button"
                className="map-tool"
                onClick={() => leafletCenter(mapRef.current, markers, focusId, anchor)}
              >
                <LocateFixed className="size-3.5" />
              </button>
            </Tip>
            <Tip text="World">
              <button type="button" className="map-tool" onClick={() => leafletWorld(mapRef.current)}>
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
