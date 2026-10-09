import type { Map as LeafletMap } from "leaflet";
import type { MapMarker } from "@/lib/geo";
import { MAP_TILE_MAX_ZOOM } from "@/lib/map-tiles";

export function leafletZoomBy(map: LeafletMap | null, delta: number) {
  if (!map) return;
  if (delta > 0) map.zoomIn();
  else map.zoomOut();
}

export function leafletWorld(map: LeafletMap | null) {
  map?.setView([20, 12], 2, { animate: false });
}

export function leafletCenter(
  map: LeafletMap | null,
  markers: MapMarker[],
  focusId?: string | null,
  anchor?: { lat: number; lng: number } | null,
) {
  if (!map) return;
  const focus = markers.find((row) => row.id === focusId);
  if (focus && Number.isFinite(focus.lat) && Number.isFinite(focus.lng)) {
    map.setView([focus.lat, focus.lng], Math.min(MAP_TILE_MAX_ZOOM, Math.max(map.getZoom(), 6)), {
      animate: false,
    });
    return;
  }
  if (anchor && Number.isFinite(anchor.lat) && Number.isFinite(anchor.lng)) {
    map.setView([anchor.lat, anchor.lng], Math.min(MAP_TILE_MAX_ZOOM, 6), { animate: false });
    return;
  }
  if (markers.length) {
    const pts = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
    if (pts.length === 1) {
      map.setView([pts[0].lat, pts[0].lng], 8, { animate: false });
      return;
    }
    if (pts.length > 1) {
      const lats = pts.map((p) => p.lat);
      const lngs = pts.map((p) => p.lng);
      let south = Math.min(...lats);
      let north = Math.max(...lats);
      let west = Math.min(...lngs);
      let east = Math.max(...lngs);
      const latPad = Math.max(0.25, (north - south) * 0.15);
      const lngPad = Math.max(0.25, (east - west) * 0.15);
      south -= latPad;
      north += latPad;
      west -= lngPad;
      east += lngPad;
      map.fitBounds(
        [
          [south, west],
          [north, east],
        ],
        {
          maxZoom: Math.min(MAP_TILE_MAX_ZOOM, 12),
          animate: false,
        },
      );
      return;
    }
  }
  leafletWorld(map);
}
