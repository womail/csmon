import type { MapMarker } from "./geo";

export type MarkerCluster = {
  id: string;
  lat: number;
  lng: number;
  count: number;
  kind: MapMarker["kind"];
  members: MapMarker[];
};

type PixelRow = { marker: MapMarker; x: number; y: number };

function dominantKind(members: MapMarker[]): MapMarker["kind"] {
  const totals = new Map<MapMarker["kind"], number>();
  for (const marker of members) {
    totals.set(marker.kind, (totals.get(marker.kind) ?? 0) + (marker.count ?? 1));
  }
  let best: MapMarker["kind"] = members[0]?.kind ?? "place";
  let bestN = -1;
  for (const [kind, n] of totals) {
    if (n > bestN) {
      best = kind;
      bestN = n;
    }
  }
  return best;
}

/** Group markers that fall in the same screen cell. Larger zoom spreads them apart. */
export function clusterByCell(rows: PixelRow[], cellPx: number): MarkerCluster[] {
  const cell = Math.max(8, cellPx);
  const groups = new Map<string, PixelRow[]>();
  for (const row of rows) {
    const key = `${Math.floor(row.x / cell)}:${Math.floor(row.y / cell)}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }
  const clusters: MarkerCluster[] = [];
  for (const [key, members] of groups) {
    const markers = members.map((row) => row.marker);
    const count = markers.reduce((sum, marker) => sum + (marker.count ?? 1), 0);
    clusters.push({
      id: `${key}:${markers
        .map((marker) => marker.id)
        .sort()
        .slice(0, 4)
        .join(",")}`,
      lat: markers.reduce((sum, marker) => sum + marker.lat, 0) / markers.length,
      lng: markers.reduce((sum, marker) => sum + marker.lng, 0) / markers.length,
      count,
      kind: dominantKind(markers),
      members: markers,
    });
  }
  return clusters;
}
