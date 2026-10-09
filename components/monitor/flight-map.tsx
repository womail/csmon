"use client";

import { TiledMapPanel } from "@/components/monitor/tiled-map-panel";
import type { MapMarker } from "@/lib/geo";

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
  const hint = markers.length
    ? `${markers.length} airborne · OpenStreetMap · expand for full screen`
    : "No airborne tracks yet.";

  return (
    <div className="map-panel map-panel--fill">
      <TiledMapPanel
        title="Live tracks"
        hint={hint}
        markers={markers}
        focusId={focusId}
        anchor={anchor}
        onSelect={onSelect}
        frameClassName="geo-map-frame--fill"
        lazy={false}
      />
    </div>
  );
}
