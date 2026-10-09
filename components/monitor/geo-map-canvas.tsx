"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import L from "leaflet";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Pane,
  TileLayer,
  ZoomControl,
  useMap,
} from "react-leaflet";
import { KIND_COLOR } from "@/components/monitor/map-colors";
import type { MapMarker } from "@/lib/geo";
import {
  MAP_TILE_MAX_ZOOM,
  osmTileAttribution,
  osmTileSubdomains,
  osmTileUrl,
} from "@/lib/map-tiles";
import "leaflet/dist/leaflet.css";

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
  const fitted = useRef(false);
  const markerKey = markers
    .map((row) => `${row.id}:${row.lat.toFixed(2)},${row.lng.toFixed(2)}`)
    .join("|");

  useEffect(() => {
    fitted.current = false;
  }, [markerKey]);

  useEffect(() => {
    if (focus && Number.isFinite(focus.lat) && Number.isFinite(focus.lng)) {
      if (lastFocus.current !== focus.id) {
        lastFocus.current = focus.id;
        map.setView([focus.lat, focus.lng], Math.min(MAP_TILE_MAX_ZOOM, Math.max(map.getZoom(), 6)), {
          animate: false,
        });
      }
      return;
    }
    if (anchor && Number.isFinite(anchor.lat) && Number.isFinite(anchor.lng) && !fitted.current) {
      fitted.current = true;
      map.setView([anchor.lat, anchor.lng], Math.min(MAP_TILE_MAX_ZOOM, 6), { animate: false });
      return;
    }
    if (fitted.current) return;
    const pts = markers.filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng));
    if (!pts.length) {
      map.setView([20, 12], 2, { animate: false });
      return;
    }
    fitted.current = true;
    if (pts.length === 1) {
      map.setView([pts[0].lat, pts[0].lng], 3, { animate: false });
      return;
    }
    map.fitBounds(L.latLngBounds(pts.map((row) => [row.lat, row.lng])).pad(0.2), {
      maxZoom: Math.min(MAP_TILE_MAX_ZOOM, interactive ? 12 : 8),
      animate: false,
    });
  }, [anchor, focus, interactive, map, markerKey, markers]);

  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 60);
    const id2 = window.setTimeout(() => map.invalidateSize(), 400);
    return () => {
      window.clearTimeout(id);
      window.clearTimeout(id2);
    };
  }, [map]);

  return null;
}

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer().parentElement;
    if (!el) return;
    const fix = () => map.invalidateSize();
    fix();
    const ro = new ResizeObserver(fix);
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function Markers({
  markers,
  focusId,
  onSelect,
}: {
  markers: MapMarker[];
  focusId?: string | null;
  onSelect?: (name: string, marker?: MapMarker) => void;
}) {
  return (
    <Pane name="markers" style={{ zIndex: 450 }}>
      {markers.map((marker) => {
        if (marker.kind === "flight") {
          return (
            <Marker
              key={marker.id}
              position={[marker.lat, marker.lng]}
              icon={planeIcon(marker.heading, marker.id === focusId, 22)}
              eventHandlers={{ click: () => onSelect?.(marker.name, marker) }}
            />
          );
        }
        const r = marker.kind === "quake" ? 7 : 6;
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
            eventHandlers={{ click: () => onSelect?.(marker.name, marker) }}
          />
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
  anchor,
}: {
  markers: MapMarker[];
  focusId?: string | null;
  interactive: boolean;
  onSelect?: (name: string, marker?: MapMarker) => void;
  mapRef?: MutableRefObject<L.Map | null>;
  anchor?: { lat: number; lng: number } | null;
}) {
  const dark = useDark();
  const focus = markers.find((row) => row.id === focusId) ?? null;

  return (
    <MapContainer
      ref={(map) => {
        if (mapRef) mapRef.current = map;
      }}
      center={[20, 12]}
      zoom={2}
      minZoom={1}
      maxZoom={MAP_TILE_MAX_ZOOM}
      className="geo-map-canvas"
      scrollWheelZoom={interactive}
      dragging={interactive}
      doubleClickZoom={interactive}
      zoomControl={false}
      attributionControl
      preferCanvas
      zoomAnimation={false}
      fadeAnimation={false}
      markerZoomAnimation={false}
    >
      <TileLayer
        key={dark ? "dark" : "light"}
        url={osmTileUrl(dark)}
        subdomains={osmTileSubdomains()}
        attribution={osmTileAttribution()}
        maxZoom={MAP_TILE_MAX_ZOOM}
        minZoom={1}
        updateWhenZooming={false}
        updateWhenIdle
        keepBuffer={1}
        tileSize={256}
      />
      <MapResizeFix />
      {interactive ? <ZoomControl position="topleft" /> : null}
      <FitAndFly markers={markers} focus={focus} interactive={interactive} anchor={anchor} />
      {anchor ? (
        <Circle
          center={[anchor.lat, anchor.lng]}
          radius={100000}
          pathOptions={{ color: "#1d4ed8", weight: 1, fillColor: "#3b82f6", fillOpacity: 0.05 }}
        />
      ) : null}
      <Markers markers={markers} focusId={focusId} onSelect={onSelect} />
    </MapContainer>
  );
}
