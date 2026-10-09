"use client";

import { ResizablePanel } from "@/components/monitor/resizable-panel";
import { TiledMapPanel } from "@/components/monitor/tiled-map-panel";
import { KIND_COLOR } from "@/components/monitor/map-colors";
import type { MapMarker } from "@/lib/geo";

export function SituationMap({
  title,
  markers,
  onSelect,
  empty = "No mapped places in this view.",
  resizeKey = "csmon.map-height.situation",
  lazy = true,
}: {
  title: string;
  markers: MapMarker[];
  onSelect?: (name: string, marker?: MapMarker) => void;
  empty?: string;
  resizeKey?: string;
  lazy?: boolean;
}) {
  const hint = markers.length
    ? `${markers.length} mapped · OpenStreetMap · expand for full screen`
    : empty;

  return (
    <div className="map-panel-root card-tile overflow-hidden p-0">
      <ResizablePanel storageKey={resizeKey} defaultHeight={240} minHeight={160} maxHeight={480}>
        <div className="map-panel">
          <TiledMapPanel
            title={title}
            hint={hint}
            markers={markers}
            onSelect={onSelect}
            lazy={lazy}
            centerDisabled={!markers.length}
          />
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
    </div>
  );
}
