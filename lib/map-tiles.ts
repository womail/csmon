/** OpenStreetMap raster tiles (standard slippy map). */

export function osmTileUrl(_dark?: boolean) {
  return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
}

export function osmTileAttribution() {
  return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
}

export function osmTileSubdomains() {
  return "abc";
}

/** Match OSM’s usable zoom range in Leaflet panels and pop-outs. */
export const MAP_TILE_MAX_ZOOM = 16;

export function osmTileClass() {
  return "";
}
