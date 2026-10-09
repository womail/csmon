/** Plate-style fast map in Web Mercator — matches OSM tiles when zoomed in. */

export const FAST_MAP_W = 1024;
export const FAST_MAP_H = 512;
export const FAST_MAP_MIN_ZOOM = -1;
export const FAST_MAP_MAX_ZOOM = 8;

const MERC_MAX_LAT = 85.05112878;

export type FastMapView = {
  lat: number;
  lng: number;
  zoom: number;
};

function mercatorYRad(latRad: number) {
  return Math.log(Math.tan(Math.PI / 4 + latRad / 2));
}

export function clampLat(lat: number) {
  return Math.max(-MERC_MAX_LAT, Math.min(MERC_MAX_LAT, lat));
}

export function worldX(lng: number, w = FAST_MAP_W) {
  return ((lng + 180) / 360) * w;
}

export function worldY(lat: number, h = FAST_MAP_H) {
  const latRad = (clampLat(lat) * Math.PI) / 180;
  return ((1 - mercatorYRad(latRad) / Math.PI) / 2) * h;
}

export function project(lat: number, lng: number, view: FastMapView) {
  const scale = Math.pow(2, view.zoom);
  const cx = worldX(view.lng);
  const cy = worldY(view.lat);
  const wx = worldX(lng);
  const wy = worldY(lat);
  return {
    x: FAST_MAP_W / 2 + (wx - cx) * scale,
    y: FAST_MAP_H / 2 + (wy - cy) * scale,
  };
}

export function landTransform(view: FastMapView) {
  const scale = Math.pow(2, view.zoom);
  const cx = worldX(view.lng);
  const cy = worldY(view.lat);
  return `translate(${FAST_MAP_W / 2} ${FAST_MAP_H / 2}) scale(${scale}) translate(${-cx} ${-cy})`;
}
