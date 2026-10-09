/** Map helpers — Leaflet OSM panels (lazy-loaded where noted). */

import { markersForPlaces, type MapMarker } from "@/lib/geo";

export { SituationMap } from "@/components/monitor/situation-map";
export { FlightMap } from "@/components/monitor/flight-map";
export { TiledMapPanel } from "@/components/monitor/tiled-map-panel";
export { KIND_COLOR } from "@/components/monitor/map-colors";

export function placeMarkers(
  places: { name: string; count?: number; hint?: string }[],
  kind: MapMarker["kind"] = "place",
) {
  return markersForPlaces(places, kind);
}
