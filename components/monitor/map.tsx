/** Map helpers — Leaflet lives in flight-map / leaflet-popout (lazy chunks). */

import { markersForPlaces, type MapMarker } from "@/lib/geo";

export { SituationMap } from "@/components/monitor/situation-map";
export { FlightMap } from "@/components/monitor/flight-map";
export { KIND_COLOR } from "@/components/monitor/map-colors";

export function placeMarkers(
  places: { name: string; count?: number; hint?: string }[],
  kind: MapMarker["kind"] = "place",
) {
  return markersForPlaces(places, kind);
}
