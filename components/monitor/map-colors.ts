import type { MapMarker } from "@/lib/geo";

export const KIND_COLOR: Record<MapMarker["kind"], string> = {
  place: "#0e7490",
  quake: "#c2410c",
  weather: "#0369a1",
  war: "#b91c1c",
  unrest: "#7c3aed",
  source: "#334155",
  flight: "#1d4ed8",
};
