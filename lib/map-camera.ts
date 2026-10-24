import { MAP_TILE_MAX_ZOOM } from "./map-tiles";

/** Page-URL camera. These names are not board filters; flights and weather use them only on their own API calls. */
export const MAP_CAMERA_KEYS = ["lat", "lng", "z"] as const;

export type MapCamera = {
  lat: number;
  lng: number;
  zoom: number;
};

export function parseMapCamera(search: string): MapCamera | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const zoom = Number(params.get("z"));
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  if (!Number.isFinite(zoom) || zoom < 1 || zoom > MAP_TILE_MAX_ZOOM) return null;
  return { lat, lng, zoom };
}

export function writeMapCamera(camera: MapCamera) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  params.set("lat", camera.lat.toFixed(3));
  params.set("lng", camera.lng.toFixed(3));
  params.set("z", String(Math.round(camera.zoom)));
  const qs = params.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  if (next !== `${window.location.pathname}${window.location.search}`) {
    window.history.replaceState(null, "", next);
  }
}

/** Keep a camera already on the page URL when filters are rewritten. */
export function retainMapCamera(params: URLSearchParams) {
  if (typeof window === "undefined") return;
  const current = new URLSearchParams(window.location.search);
  for (const key of MAP_CAMERA_KEYS) {
    const value = current.get(key);
    if (value) params.set(key, value);
  }
}
