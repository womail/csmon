"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { FeatureCollection } from "geojson";
import L from "leaflet";
import {
  Circle,
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Pane,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import { KIND_COLOR } from "@/components/monitor/map-colors";
import type { MapMarker } from "@/lib/geo";
import { resolvePlace } from "@/lib/places";
import "leaflet/dist/leaflet.css";

const COUNTRY_LABELS = [
  { name: "Canada", lat: 56.1, lng: -106.3 },
  { name: "United States", lat: 39.8, lng: -98.6 },
  { name: "Mexico", lat: 23.6, lng: -102.5 },
  { name: "Brazil", lat: -10.8, lng: -53.1 },
  { name: "Argentina", lat: -34.6, lng: -65.2 },
  { name: "United Kingdom", lat: 54.8, lng: -2.6 },
  { name: "France", lat: 46.6, lng: 2.3 },
  { name: "Germany", lat: 51.2, lng: 10.4 },
  { name: "Spain", lat: 40.4, lng: -3.7 },
  { name: "Italy", lat: 42.8, lng: 12.6 },
  { name: "Ukraine", lat: 49.0, lng: 32.0 },
  { name: "Russia", lat: 61.5, lng: 90.0 },
  { name: "Turkey", lat: 39.0, lng: 35.2 },
  { name: "Egypt", lat: 26.8, lng: 30.8 },
  { name: "Nigeria", lat: 9.6, lng: 8.0 },
  { name: "South Africa", lat: -29.0, lng: 24.7 },
  { name: "Iran", lat: 32.4, lng: 53.7 },
  { name: "Saudi Arabia", lat: 24.0, lng: 45.0 },
  { name: "India", lat: 22.9, lng: 79.6 },
  { name: "China", lat: 35.9, lng: 103.8 },
  { name: "Japan", lat: 36.2, lng: 138.3 },
  { name: "Australia", lat: -25.3, lng: 133.8 },
  { name: "Indonesia", lat: -2.2, lng: 117.0 },
  { name: "Kazakhstan", lat: 48.0, lng: 67.0 },
];

const ATLAS_FILL = ["#d7e4c8", "#f0dcc0", "#d4e0ef", "#ebd3d3", "#ddd4ea", "#cfe6df", "#efe3c4", "#d8d6c4"];
const ATLAS_FILL_DARK = ["#314236", "#3d3428", "#2c3644", "#3a2c2c", "#332e40", "#2a3c38", "#3a3424", "#34342c"];

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

function countryName(properties: GeoJSON.GeoJsonProperties) {
  if (!properties) return "";
  return String(properties.NAME || properties.ADMIN || properties.SOVEREIGNT || "");
}

function countryFill(properties: GeoJSON.GeoJsonProperties, dark = false) {
  const name = countryName(properties);
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const palette = dark ? ATLAS_FILL_DARK : ATLAS_FILL;
  return palette[hash % palette.length];
}

function planeIcon(heading: number | null | undefined, active: boolean, size: number) {
  const deg = Number.isFinite(heading) ? Number(heading) : 0;
  return L.divIcon({
    className: `aircraft-icon${active ? " is-active" : ""}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="aircraft-rot" style="width:${size}px;height:${size}px;transform:rotate(${deg}deg)">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 1.4 14 11.2 22 14.2 13.8 14.6 13 22.2 12 20.2 11 22.2 10.2 14.6 2 14.2 10 11.2Z"/>
      </svg>
    </div>`,
  });
}

function FitAndFly({
  markers,
  focus,
  interactive,
  anchor,
}: {
  markers: MapMarker[];
  focus: MapMarker | null;
  interactive: boolean;
  anchor?: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  const lastFocus = useRef<string | null>(null);
  const lastAnchor = useRef<string>("");
  const fitted = useRef(false);
  const anchorKey = anchor ? `${anchor.lat.toFixed(3)},${anchor.lng.toFixed(3)}` : "";
  useEffect(() => {
    if (lastAnchor.current !== anchorKey) {
      lastAnchor.current = anchorKey;
      fitted.current = false;
    }
    if (focus && Number.isFinite(focus.lat) && Number.isFinite(focus.lng)) {
      if (lastFocus.current !== focus.id) {
        lastFocus.current = focus.id;
        map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), interactive ? 6 : 4), {
          duration: 0.55,
        });
      }
      return;
    }
    if (anchor && Number.isFinite(anchor.lat) && Number.isFinite(anchor.lng) && !fitted.current) {
      fitted.current = true;
      map.setView([anchor.lat, anchor.lng], 9);
      return;
    }
    if (fitted.current) return;
    const pts = markers.filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng));
    if (pts.length === 0) {
      map.setView([20, 12], 2);
      return;
    }
    fitted.current = true;
    if (pts.length === 1) {
      map.setView([pts[0].lat, pts[0].lng], 4);
      return;
    }
    map.fitBounds(
      L.latLngBounds(pts.map((row) => [row.lat, row.lng])).pad(0.18),
      { maxZoom: interactive ? 5 : 4, animate: false },
    );
  }, [anchor, focus, interactive, map, markers]);
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(id);
  }, [map]);
  return null;
}

function CountryNames() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
    };
  }, [map]);
  if (zoom > 5.2) return null;
  return (
    <>
      {COUNTRY_LABELS.map((row) => (
        <Marker
          key={row.name}
          position={[row.lat, row.lng]}
          interactive={false}
          icon={L.divIcon({
            className: "country-name",
            html: `<span>${row.name}</span>`,
            iconSize: [0, 0],
          })}
        />
      ))}
    </>
  );
}

function ZoomIcons({
  markers,
  focusId,
  onSelect,
}: {
  markers: MapMarker[];
  focusId?: string | null;
  onSelect?: (name: string, marker?: MapMarker) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
    };
  }, [map]);
  const size = zoom < 3 ? 18 : zoom < 5 ? 24 : 30;
  return (
    <Pane name="markers" style={{ zIndex: 450 }}>
      {markers.map((marker) => {
        if (marker.kind === "flight") {
          return (
            <Marker
              key={marker.id}
              position={[marker.lat, marker.lng]}
              icon={planeIcon(marker.heading, marker.id === focusId, size)}
              eventHandlers={{
                click: () => onSelect?.(marker.name, marker),
              }}
            >
              <Tooltip>
                {marker.hint ? `${marker.name} · ${marker.hint}` : marker.name}
              </Tooltip>
            </Marker>
          );
        }
        const r = marker.kind === "quake" ? 7 : marker.kind === "weather" ? 6 : 6;
        const active = marker.id === focusId;
        return (
          <CircleMarker
            key={marker.id}
            center={[marker.lat, marker.lng]}
            radius={active ? r + 2 : r}
            pathOptions={{
              color: active ? "#0f172a" : KIND_COLOR[marker.kind],
              weight: active ? 2 : 1,
              fillColor: KIND_COLOR[marker.kind],
              fillOpacity: 0.9,
            }}
            eventHandlers={{
              click: () => onSelect?.(marker.name, marker),
            }}
          >
            <Tooltip>
              {marker.hint
                ? `${marker.name} · ${marker.hint}`
                : marker.count
                  ? `${marker.name} · ${marker.count}`
                  : marker.name}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </Pane>
  );
}

export default function GeoMapCanvas({
  markers,
  focusId,
  interactive,
  onSelect,
  mapRef,
  showTiles,
  anchor,
}: {
  markers: MapMarker[];
  focusId?: string | null;
  interactive: boolean;
  onSelect?: (name: string, marker?: MapMarker) => void;
  mapRef?: MutableRefObject<L.Map | null>;
  showTiles?: boolean;
  anchor?: { lat: number; lng: number } | null;
}) {
  const [countries, setCountries] = useState<FeatureCollection | null>(null);
  const dark = useDark();
  const focus = markers.find((row) => row.id === focusId) ?? null;

  useEffect(() => {
    let cancelled = false;
    fetch("/geo/countries.geojson")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: FeatureCollection | null) => {
        if (!cancelled && data) setCountries(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <MapContainer
      ref={(map) => {
        if (mapRef) mapRef.current = map;
      }}
      center={[20, 12]}
      zoom={2}
      minZoom={1}
      maxZoom={12}
      className="geo-map-canvas"
      scrollWheelZoom={interactive}
      dragging
      doubleClickZoom={interactive}
      zoomControl={interactive}
      attributionControl={false}
      worldCopyJump
    >
      <FitAndFly markers={markers} focus={focus} interactive={interactive} anchor={anchor} />
      {anchor ? (
        <Circle
          center={[anchor.lat, anchor.lng]}
          radius={100000}
          pathOptions={{ color: "#1d4ed8", weight: 1.2, fillColor: "#3b82f6", fillOpacity: 0.06 }}
        />
      ) : null}
      {showTiles ? (
        <TileLayer
          key={dark ? "dark" : "light"}
          url={
            dark
              ? "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          }
          attribution="Tiles &copy; Esri"
        />
      ) : null}
      {countries ? (
        <GeoJSON
          key={dark ? "countries-dark" : "countries-light"}
          data={countries}
          style={(feature) => ({
            color: showTiles ? (dark ? "#94a3b8" : "#1e293b") : dark ? "#64748b" : "#475569",
            weight: showTiles ? 0.9 : 1,
            fillColor: countryFill(feature?.properties ?? null, dark),
            fillOpacity: showTiles ? (dark ? 0.12 : 0.08) : 0.92,
          })}
          onEachFeature={(feature, layer) => {
            const name = countryName(feature.properties);
            if (name) layer.bindTooltip(name, { sticky: true, className: "country-tip" });
            if (!showTiles && onSelect && name) {
              layer.on("click", () => onSelect(resolvePlace(name)));
            }
          }}
        />
      ) : null}
      <CountryNames />
      <ZoomIcons markers={markers} focusId={focusId} onSelect={onSelect} />
    </MapContainer>
  );
}
