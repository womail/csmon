export type GeoPoint = {
  name: string;
  lat: number;
  lng: number;
};

export const PLACE_COORDS: GeoPoint[] = [
  { name: "Ukraine", lat: 49.0, lng: 32.0 },
  { name: "Russia", lat: 55.8, lng: 37.6 },
  { name: "China", lat: 39.9, lng: 116.4 },
  { name: "Taiwan", lat: 25.0, lng: 121.5 },
  { name: "Israel", lat: 31.8, lng: 35.2 },
  { name: "Gaza", lat: 31.4, lng: 34.4 },
  { name: "Iran", lat: 35.7, lng: 51.4 },
  { name: "Syria", lat: 33.5, lng: 36.3 },
  { name: "Yemen", lat: 15.4, lng: 44.2 },
  { name: "Sudan", lat: 15.5, lng: 32.5 },
  { name: "Sahel", lat: 15.0, lng: 0.0 },
  { name: "US", lat: 38.9, lng: -77.0 },
  { name: "UK", lat: 54.5, lng: -2.5 },
  { name: "London", lat: 51.507, lng: -0.128 },
  { name: "United Kingdom", lat: 54.5, lng: -2.5 },
  { name: "Ireland", lat: 53.4, lng: -7.9 },
  { name: "Dublin", lat: 53.3498, lng: -6.2603 },
  { name: "Cork", lat: 51.8985, lng: -8.4756 },
  { name: "Belfast", lat: 54.5973, lng: -5.9301 },
  { name: "EU", lat: 50.8, lng: 4.4 },
  { name: "Korea", lat: 37.6, lng: 127.0 },
  { name: "Japan", lat: 35.7, lng: 139.7 },
  { name: "India", lat: 28.6, lng: 77.2 },
  { name: "Pakistan", lat: 33.7, lng: 73.1 },
  { name: "Mexico", lat: 19.4, lng: -99.1 },
  { name: "Venezuela", lat: 10.5, lng: -66.9 },
  { name: "Haiti", lat: 18.5, lng: -72.3 },
  { name: "Lebanon", lat: 33.9, lng: 35.5 },
  { name: "Turkey", lat: 39.9, lng: 32.9 },
  { name: "Germany", lat: 52.5, lng: 13.4 },
  { name: "France", lat: 48.9, lng: 2.4 },
  { name: "Arctic", lat: 78.0, lng: -40.0 },
  { name: "Red Sea", lat: 20.0, lng: 38.5 },
  { name: "Taiwan Strait", lat: 24.5, lng: 119.5 },
  { name: "Indonesia", lat: -6.2, lng: 106.8 },
  { name: "Philippines", lat: 14.6, lng: 121.0 },
  { name: "California", lat: 36.8, lng: -119.4 },
  { name: "Alaska", lat: 61.2, lng: -149.9 },
  { name: "Chile", lat: -33.4, lng: -70.7 },
  { name: "Italy", lat: 41.9, lng: 12.5 },
  { name: "Greece", lat: 38.0, lng: 23.7 },
  { name: "Afghanistan", lat: 34.5, lng: 69.2 },
  { name: "Myanmar", lat: 19.8, lng: 96.1 },
  { name: "Ethiopia", lat: 9.0, lng: 38.7 },
  { name: "Somalia", lat: 2.0, lng: 45.3 },
  { name: "Libya", lat: 32.9, lng: 13.2 },
  { name: "Nigeria", lat: 9.1, lng: 7.5 },
  { name: "Brazil", lat: -15.8, lng: -47.9 },
  { name: "Australia", lat: -35.3, lng: 149.1 },
  { name: "Canada", lat: 45.4, lng: -75.7 },
  { name: "Spain", lat: 40.4, lng: -3.7 },
  { name: "Poland", lat: 52.2, lng: 21.0 },
  { name: "Iraq", lat: 33.3, lng: 44.4 },
  { name: "West Bank", lat: 31.9, lng: 35.2 },
  { name: "Caribbean", lat: 18.2, lng: -66.5 },
  { name: "Pacific", lat: 10.0, lng: 160.0 },
  { name: "Horn of Africa", lat: 8.0, lng: 48.0 },
  { name: "South China Sea", lat: 15.0, lng: 115.0 },
  { name: "Nepal", lat: 27.7, lng: 85.3 },
  { name: "New Zealand", lat: -41.3, lng: 174.8 },
  { name: "Florida", lat: 27.8, lng: -81.7 },
  { name: "Bangladesh", lat: 23.8, lng: 90.4 },
  { name: "Singapore", lat: 1.35, lng: 103.82 },
  { name: "Greenland", lat: 64.18, lng: -51.72 },
  { name: "Hormuz", lat: 26.5, lng: 56.5 },
  { name: "Malacca", lat: 2.5, lng: 101.0 },
  { name: "Suez", lat: 30.0, lng: 32.5 },
  { name: "Panama", lat: 9.1, lng: -79.7 },
  { name: "Bab el-Mandeb", lat: 12.5, lng: 43.3 },
  { name: "Gibraltar", lat: 36.0, lng: -5.5 },
  { name: "Bosporus", lat: 41.1, lng: 29.0 },
];

const BY_NAME = new Map(PLACE_COORDS.map((point) => [point.name.toLowerCase(), point]));

export const HOME_CITIES: GeoPoint[] = [
  { name: "Dublin", lat: 53.3498, lng: -6.2603 },
  { name: "Cork", lat: 51.8985, lng: -8.4756 },
  { name: "Belfast", lat: 54.5973, lng: -5.9301 },
  { name: "Shannon", lat: 52.699, lng: -8.921 },
  { name: "London", lat: 51.507, lng: -0.128 },
  { name: "Manchester", lat: 53.4808, lng: -2.2426 },
  { name: "Paris", lat: 48.8566, lng: 2.3522 },
  { name: "Berlin", lat: 52.52, lng: 13.405 },
  { name: "Amsterdam", lat: 52.3676, lng: 4.9041 },
  { name: "New York", lat: 40.7128, lng: -74.006 },
  { name: "Washington", lat: 38.9072, lng: -77.0369 },
  { name: "San Francisco", lat: 37.7749, lng: -122.4194 },
  { name: "Los Angeles", lat: 34.0522, lng: -118.2437 },
  { name: "Chicago", lat: 41.8781, lng: -87.6298 },
  { name: "Toronto", lat: 43.6532, lng: -79.3832 },
  { name: "Tokyo", lat: 35.6762, lng: 139.6503 },
];

export function homeCity(name: string | null | undefined) {
  if (!name) return null;
  return HOME_CITIES.find((row) => row.name.toLowerCase() === name.toLowerCase()) ?? null;
}

export function kmBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * sinLng * sinLng;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function bboxAround(lat: number, lng: number, km: number) {
  const dLat = km / 111.32;
  const dLng = km / (111.32 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return {
    lamin: lat - dLat,
    lamax: lat + dLat,
    lomin: lng - dLng,
    lomax: lng + dLng,
  };
}

export type MapMarker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: "place" | "quake" | "weather" | "war" | "unrest" | "source" | "flight";
  count?: number;
  hint?: string;
  heading?: number | null;
  /** Set when this pin is one story, so a zoomed-in cluster can open it. */
  storyId?: string;
  /** Event time, so the map scrubber can hide pins that have not happened yet. */
  at?: number;
};

export function coordsForPlace(name: string) {
  return BY_NAME.get(name.toLowerCase()) ?? null;
}

export function project(lat: number, lng: number, width = 360, height = 160) {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
}

export function markersForPlaces(
  places: { name: string; count?: number; hint?: string }[],
  kind: MapMarker["kind"] = "place",
): MapMarker[] {
  const markers: MapMarker[] = [];
  for (const place of places) {
    const point = coordsForPlace(place.name);
    if (!point) continue;
    markers.push({
      id: `${kind}-${place.name}`,
      name: place.name,
      lat: point.lat,
      lng: point.lng,
      kind,
      count: place.count,
      hint: place.hint,
    });
  }
  return markers;
}
