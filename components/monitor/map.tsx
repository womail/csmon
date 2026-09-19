"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { Expand, Globe2, LocateFixed, Minus, Plus, X } from "lucide-react";
import { Tip } from "@/components/monitor/tip";
import { KIND_COLOR } from "@/components/monitor/map-colors";
import { markersForPlaces, type MapMarker } from "@/lib/geo";

const GeoMapCanvas = dynamic(() => import("./geo-map-canvas"), {
  ssr: false,
  loading: () => <div className="geo-map-skeleton">Loading countries…</div>,
});

function MapTools({
  onZoom,
  onWorld,
  onCenter,
  onPopout,
  canCenter,
}: {
  onZoom: (delta: number) => void;
  onWorld: () => void;
  onCenter: () => void;
  onPopout?: () => void;
  canCenter: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Tip text="Zoom in">
        <button type="button" className="map-tool" onClick={() => onZoom(1)}>
          <Plus className="size-3.5" />
        </button>
      </Tip>
      <Tip text="Zoom out">
        <button type="button" className="map-tool" onClick={() => onZoom(-1)}>
          <Minus className="size-3.5" />
        </button>
      </Tip>
      <Tip text="Center on the selection">
        <button type="button" className="map-tool" onClick={onCenter} disabled={!canCenter}>
          <LocateFixed className="size-3.5" />
        </button>
      </Tip>
      <Tip text="Show the whole world">
        <button type="button" className="map-tool" onClick={onWorld}>
          <Globe2 className="size-3.5" />
        </button>
      </Tip>
      {onPopout ? (
        <Tip text="Pop the map out to a larger view">
          <button type="button" className="map-tool" onClick={onPopout}>
            <Expand className="size-3.5" />
          </button>
        </Tip>
      ) : null}
    </div>
  );
}

function useMapTools(focusId?: string | null, markers: MapMarker[] = [], anchor?: { lat: number; lng: number } | null) {
  const mapRef = useRef<LeafletMap | null>(null);

  function zoomBy(delta: number) {
    const map = mapRef.current;
    if (!map) return;
    if (delta > 0) map.zoomIn();
    else map.zoomOut();
  }

  function world() {
    mapRef.current?.setView([20, 12], 2);
  }

  function center() {
    const map = mapRef.current;
    const focus = markers.find((row) => row.id === focusId);
    if (!map) return;
    if (focus) map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 6));
    else if (anchor) map.flyTo([anchor.lat, anchor.lng], 9);
    else world();
  }

  return { mapRef, zoomBy, world, center };
}

function MapFrame({
  title,
  markers,
  interactive,
  focusId,
  onSelect,
  empty,
  heightClass,
  showTiles,
  allowPopout = true,
  anchor,
}: {
  title: string;
  markers: MapMarker[];
  interactive?: boolean;
  focusId?: string | null;
  onSelect?: (name: string, marker?: MapMarker) => void;
  empty?: string;
  heightClass: string;
  showTiles?: boolean;
  allowPopout?: boolean;
  anchor?: { lat: number; lng: number } | null;
}) {
  const pane = useMapTools(focusId, markers, anchor);
  const popped = useMapTools(focusId, markers, anchor);
  const [popout, setPopout] = useState(false);

  return (
    <div className="map-panel">
      <div className="map-toolbar">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">{title}</div>
          <p className="truncate text-[11px] text-slate-500">
            {markers.length
              ? `${markers.length} mapped · zoom, drag, or pop out`
              : empty ?? "No mapped points in this view."}
          </p>
        </div>
        <MapTools
          onZoom={pane.zoomBy}
          onWorld={pane.world}
          onCenter={pane.center}
          onPopout={allowPopout ? () => setPopout(true) : undefined}
          canCenter={Boolean(focusId || anchor)}
        />
      </div>
      <div className={`geo-map-frame ${heightClass}`}>
        <GeoMapCanvas
          markers={markers}
          focusId={focusId}
          interactive={Boolean(interactive)}
          onSelect={onSelect}
          mapRef={pane.mapRef}
          showTiles={showTiles}
          anchor={anchor}
        />
      </div>
      {popout ? (
        <div className="map-popout" role="dialog" aria-label={`${title} popped out`}>
          <div className="map-popout-panel">
            <div className="map-toolbar">
              <div className="text-[12px] font-semibold text-slate-800">{title}</div>
              <div className="flex items-center gap-1">
                <MapTools
                  onZoom={popped.zoomBy}
                  onWorld={popped.world}
                  onCenter={popped.center}
                  canCenter={Boolean(focusId || anchor)}
                />
                <button type="button" className="map-tool" onClick={() => setPopout(false)}>
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
                mapRef={popped.mapRef}
                showTiles={showTiles}
                anchor={anchor}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SituationMap({
  title,
  markers,
  onSelect,
  empty = "No mapped places in this view.",
}: {
  title: string;
  markers: MapMarker[];
  onSelect?: (name: string, marker?: MapMarker) => void;
  empty?: string;
}) {
  return (
    <div className="card-tile overflow-hidden p-0">
      <MapFrame
        title={title}
        markers={markers}
        interactive
        empty={empty}
        heightClass="h-[260px]"
        onSelect={onSelect}
      />
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
    </div>
  );
}

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
  return (
    <MapFrame
      title="Live tracks"
      markers={markers}
      interactive
      focusId={focusId}
      onSelect={onSelect}
      empty="No airborne tracks yet."
      heightClass="h-full min-h-[420px]"
      showTiles
      anchor={anchor}
    />
  );
}

export function placeMarkers(
  places: { name: string; count?: number; hint?: string }[],
  kind: MapMarker["kind"] = "place",
) {
  return markersForPlaces(places, kind);
}

export { KIND_COLOR };
