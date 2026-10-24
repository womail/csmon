"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import L from "leaflet";
import {
  Circle,
  MapContainer,
  Marker,
  Pane,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { KIND_COLOR } from "@/components/monitor/map-colors";
import type { MapMarker } from "@/lib/geo";
import type { MapCamera } from "@/lib/map-camera";
import type { MapFrame } from "@/lib/situation-brief";
import { clusterByCell, type MarkerCluster } from "@/lib/map-clusters";
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
  camera,
}: {
  markers: MapMarker[];
  focus: MapMarker | null;
  interactive: boolean;
  anchor?: { lat: number; lng: number } | null;
  camera?: MapCamera | null;
}) {
  const map = useMap();
  const lastFocus = useRef<string | null>(null);
  const fitted = useRef(false);
  const cameraApplied = useRef(false);

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
    if (camera && !cameraApplied.current) {
      cameraApplied.current = true;
      fitted.current = true;
      map.setView([camera.lat, camera.lng], camera.zoom, { animate: false });
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
  }, [anchor, camera, focus, interactive, map, markers]);

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

function FrameWatch({ onFrame }: { onFrame: (frame: MapFrame) => void }) {
  const map = useMap();
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  useEffect(() => {
    const bounds = map.getBounds();
    onFrameRef.current({
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    });
  }, [map]);
  useMapEvents({
    moveend: () => {
      const bounds = map.getBounds();
      onFrameRef.current({
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
      });
    },
  });
  return null;
}

function CameraWatch({ onCamera }: { onCamera: (camera: MapCamera) => void }) {
  const map = useMap();
  const onCameraRef = useRef(onCamera);
  onCameraRef.current = onCamera;
  useEffect(() => {
    const center = map.getCenter();
    onCameraRef.current({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
  }, [map]);
  useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onCameraRef.current({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
    },
  });
  return null;
}

function HeatCanvas({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  const markersRef = useRef(markers);
  const drawRef = useRef<(() => void) | null>(null);
  markersRef.current = markers;

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.className = "map-heat";
    map.getContainer().appendChild(canvas);
    let frame = 0;
    const draw = () => {
      frame = 0;
      const size = map.getSize();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(size.x * dpr));
      canvas.height = Math.max(1, Math.round(size.y * dpr));
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.x, size.y);
      ctx.globalCompositeOperation = "lighter";
      for (const marker of markersRef.current) {
        if (marker.kind === "flight" || !Number.isFinite(marker.lat) || !Number.isFinite(marker.lng)) continue;
        const point = map.latLngToContainerPoint([marker.lat, marker.lng]);
        if (point.x < -48 || point.y < -48 || point.x > size.x + 48 || point.y > size.y + 48) continue;
        const weight = Math.min(8, marker.count ?? 1);
        const radius = 18 + Math.log2(weight + 1) * 8;
        const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
        gradient.addColorStop(0, "rgba(220, 38, 38, 0.7)");
        gradient.addColorStop(0.5, "rgba(234, 88, 12, 0.28)");
        gradient.addColorStop(1, "rgba(234, 88, 12, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    drawRef.current = draw;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(draw);
    };
    map.on("move zoom resize", schedule);
    schedule();
    return () => {
      map.off("move zoom resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
      drawRef.current = null;
      canvas.remove();
    };
  }, [map]);

  useEffect(() => {
    drawRef.current?.();
  }, [markers]);

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function countIcon(count: number, color: string, title: string, active: boolean) {
  const size = count <= 1 ? 14 : Math.round(Math.min(46, 22 + Math.log2(count) * 6));
  const label = count > 1 ? String(count) : "";
  return L.divIcon({
    className: "leaflet-div-icon map-count-wrap",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="map-count${active ? " is-active" : ""}" title="${escapeHtml(title)}" style="width:${size}px;height:${size}px;background:${color};font-size:${count > 99 ? 9 : 11}px">${label}</div>`,
  });
}

function spreads(map: L.Map, members: MapMarker[], atZoom: number) {
  if (members.length < 2) return false;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const marker of members) {
    const point = map.project([marker.lat, marker.lng], atZoom);
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return Math.hypot(maxX - minX, maxY - minY) > 48;
}

function dominantName(members: MapMarker[]) {
  const totals = new Map<string, number>();
  for (const marker of members) {
    totals.set(marker.name, (totals.get(marker.name) ?? 0) + (marker.count ?? 1));
  }
  let best = members[0]?.name ?? "this area";
  let bestN = -1;
  for (const [name, n] of totals) {
    if (n > bestN) {
      best = name;
      bestN = n;
    }
  }
  return best;
}

function openMember(
  marker: MapMarker,
  onSelect?: (name: string, marker?: MapMarker) => void,
  onOpenStory?: (storyId: string) => void,
) {
  if (marker.storyId) onOpenStory?.(marker.storyId);
  else onSelect?.(marker.name, marker);
}

function CountMarkers({
  markers,
  focusId,
  onSelect,
  onOpenStory,
  onInspect,
}: {
  markers: MapMarker[];
  focusId?: string | null;
  onSelect?: (name: string, marker?: MapMarker) => void;
  onOpenStory?: (storyId: string) => void;
  onInspect?: (markers: MapMarker[]) => void;
}) {
  const map = useMap();
  const [view, setView] = useState({ zoom: map.getZoom(), token: 0 });
  useMapEvents({
    zoomend: () => setView({ zoom: map.getZoom(), token: Date.now() }),
    moveend: () => setView({ zoom: map.getZoom(), token: Date.now() }),
    resize: () => setView({ zoom: map.getZoom(), token: Date.now() }),
  });

  const flights = markers.filter((marker) => marker.kind === "flight");
  const placed = markers.filter(
    (marker) => marker.kind !== "flight" && Number.isFinite(marker.lat) && Number.isFinite(marker.lng),
  );
  const clusters = clusterByCell(
    placed.map((marker) => {
      const point = map.latLngToContainerPoint([marker.lat, marker.lng]);
      return { marker, x: point.x, y: point.y };
    }),
    42,
  );

  function onCluster(cluster: MarkerCluster) {
    if (cluster.members.length === 1) {
      openMember(cluster.members[0], onSelect, onOpenStory);
      return;
    }
    const distinct = new Set(cluster.members.map((marker) => `${marker.lat.toFixed(2)}:${marker.lng.toFixed(2)}`));
    if (distinct.size > 1) {
      map.fitBounds(
        L.latLngBounds(cluster.members.map((marker) => [marker.lat, marker.lng])),
        { padding: [28, 28], maxZoom: Math.min(MAP_TILE_MAX_ZOOM, map.getZoom() + 3), animate: false },
      );
      return;
    }
    const storyMembers = cluster.members.filter((marker) => marker.storyId);
    if (map.getZoom() < 7 && storyMembers.length > 1 && storyMembers.length <= 14) {
      map.setView([cluster.lat, cluster.lng], 7, { animate: false });
      return;
    }
    if (storyMembers.length > 1) {
      onInspect?.(cluster.members);
      return;
    }
    const lead = [...cluster.members].sort((a, b) => (b.count ?? 1) - (a.count ?? 1))[0];
    onSelect?.(lead.name, lead);
  }

  const pins: { id: string; lat: number; lng: number; count: number; kind: MapMarker["kind"]; title: string; marker: MapMarker; members: MapMarker[] }[] = [];
  for (const cluster of clusters) {
    const storyMembers = cluster.members.filter((marker) => marker.storyId);
    const zoomed = view.zoom >= 7 && storyMembers.length > 1 && storyMembers.length <= 14 && !spreads(map, storyMembers, view.zoom);
    if (zoomed) {
      const center = map.latLngToContainerPoint([cluster.lat, cluster.lng]);
      const radius = 16 + storyMembers.length;
      storyMembers.forEach((marker, index) => {
        const angle = (2 * Math.PI * index) / storyMembers.length - Math.PI / 2;
        const at = map.containerPointToLatLng([
          center.x + Math.cos(angle) * radius,
          center.y + Math.sin(angle) * radius,
        ]);
        pins.push({
          id: marker.id,
          lat: at.lat,
          lng: at.lng,
          count: 1,
          kind: marker.kind,
          title: marker.hint ?? marker.name,
          marker,
          members: [marker],
        });
      });
      const rest = cluster.members.filter((marker) => !marker.storyId);
      if (rest.length) {
        const count = rest.reduce((sum, marker) => sum + (marker.count ?? 1), 0);
        pins.push({
          id: `${cluster.id}:rest`,
          lat: cluster.lat,
          lng: cluster.lng,
          count,
          kind: rest[0].kind,
          title: rest.length > 1 ? `${count} at ${dominantName(rest)}` : (rest[0].hint ?? rest[0].name),
          marker: rest[0],
          members: rest,
        });
      }
      continue;
    }
    pins.push({
      id: cluster.id,
      lat: cluster.lat,
      lng: cluster.lng,
      count: cluster.count,
      kind: cluster.kind,
      title: cluster.members.length > 1 ? `${cluster.count} at ${dominantName(cluster.members)}` : (cluster.members[0]?.hint ?? cluster.members[0]?.name ?? ""),
      marker: cluster.members[0],
      members: cluster.members,
    });
  }

  return (
    <Pane name="markers" style={{ zIndex: 450 }}>
      {flights.map((marker) => (
        <Marker
          key={marker.id}
          position={[marker.lat, marker.lng]}
          icon={planeIcon(marker.heading, marker.id === focusId, 22)}
          eventHandlers={{ click: () => onSelect?.(marker.name, marker) }}
        />
      ))}
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          position={[pin.lat, pin.lng]}
          icon={countIcon(
            pin.count,
            KIND_COLOR[pin.kind],
            pin.title,
            pin.members.some((marker) => marker.id === focusId),
          )}
          eventHandlers={{
            click: () => {
              if (pin.members.length === 1) openMember(pin.marker, onSelect, onOpenStory);
              else onCluster({ id: pin.id, lat: pin.lat, lng: pin.lng, count: pin.count, kind: pin.kind, members: pin.members });
            },
          }}
        />
      ))}
    </Pane>
  );
}

export default function GeoMapCanvas({
  markers,
  focusId,
  interactive,
  onSelect,
  onOpenStory,
  onInspect,
  mapRef,
  anchor,
  camera,
  onCamera,
  onFrame,
  heat = false,
}: {
  markers: MapMarker[];
  focusId?: string | null;
  interactive: boolean;
  onSelect?: (name: string, marker?: MapMarker) => void;
  onOpenStory?: (storyId: string) => void;
  onInspect?: (markers: MapMarker[]) => void;
  mapRef?: MutableRefObject<L.Map | null>;
  anchor?: { lat: number; lng: number } | null;
  camera?: MapCamera | null;
  onCamera?: (camera: MapCamera) => void;
  onFrame?: (frame: MapFrame) => void;
  heat?: boolean;
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
      <FitAndFly markers={markers} focus={focus} interactive={interactive} anchor={anchor} camera={camera} />
      {onCamera ? <CameraWatch onCamera={onCamera} /> : null}
      {onFrame ? <FrameWatch onFrame={onFrame} /> : null}
      {heat ? <HeatCanvas markers={markers} /> : null}
      {anchor ? (
        <Circle
          center={[anchor.lat, anchor.lng]}
          radius={100000}
          pathOptions={{ color: "#1d4ed8", weight: 1, fillColor: "#3b82f6", fillOpacity: 0.05 }}
        />
      ) : null}
      {heat ? null : (
        <CountMarkers
          markers={markers}
          focusId={focusId}
          onSelect={onSelect}
          onOpenStory={onOpenStory}
          onInspect={onInspect}
        />
      )}
    </MapContainer>
  );
}
