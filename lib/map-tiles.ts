/** Low-res raster tiles — fast load, minimal bandwidth. */

export function osmTileUrl(dark: boolean) {
  if (dark) {
    return "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";
  }
  return "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png";
}

export function osmTileAttribution() {
  return '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
}

export function osmTileSubdomains() {
  return "abcd";
}

/** Keep tile fetches small — board pop-out does not need street level. */
export const MAP_TILE_MAX_ZOOM = 5;

export function osmTileClass() {
  return "";
}
