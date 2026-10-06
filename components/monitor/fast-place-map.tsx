"use client";

import { useMemo, useRef } from "react";
import { KIND_COLOR } from "@/components/monitor/map-colors";
import type { MapMarker } from "@/lib/geo";
import { WORLD_LAND_PATHS } from "@/lib/world-land-paths";

const W = 720;
const H = 360;

export type FastMapView = {
  lat: number;
  lng: number;
  zoom: number;
};

export function fitFastMapView(markers: MapMarker[]): FastMapView {
  const pts = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
  if (!pts.length) return { lat: 22, lng: 10, zoom: 0 };
  const lats = pts.map((m) => m.lat);
  const lngs = pts.map((m) => m.lng);
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const lngMin = Math.min(...lngs);
  const lngMax = Math.max(...lngs);
  const latSpan = Math.max(8, latMax - latMin);
  const lngSpan = Math.max(12, lngMax - lngMin);
  const span = Math.max(latSpan, lngSpan * 0.55);
  const zoom = Math.min(5, Math.max(-1, 2.4 - Math.log2(span / 45)));
  return {
    lat: (latMin + latMax) / 2,
    lng: (lngMin + lngMax) / 2,
    zoom,
  };
}

function project(lat: number, lng: number, view: FastMapView) {
  const scale = Math.pow(2, view.zoom) * (W / 360);
  const x = W / 2 + (lng - view.lng) * scale;
  const y = H / 2 - (lat - view.lat) * scale;
  return { x, y };
}

export function FastPlaceMap({
  markers,
  focusId,
  view,
  onViewChange,
  onSelect,
  interactive,
}: {
  markers: MapMarker[];
  focusId?: string | null;
  view: FastMapView;
  onViewChange: (view: FastMapView) => void;
  onSelect?: (name: string, marker?: MapMarker) => void;
  interactive?: boolean;
}) {
  const drag = useRef<{ x: number; y: number; lng: number; lat: number } | null>(null);

  const grid = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      const a = project(lat, -180, view);
      const b = project(lat, 180, view);
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, key: `lat-${lat}` });
    }
    for (let lng = -150; lng <= 150; lng += 30) {
      const a = project(85, lng, view);
      const b = project(-85, lng, view);
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, key: `lng-${lng}` });
    }
    return lines;
  }, [view]);

  const dots = useMemo(
    () =>
      markers
        .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
        .map((m) => ({ marker: m, ...project(m.lat, m.lng, view) })),
    [markers, view],
  );

  const landTransform = useMemo(() => {
    const scale = Math.pow(2, view.zoom);
    const cx = ((view.lng + 180) / 360) * W;
    const cy = ((90 - view.lat) / 180) * H;
    return `translate(${W / 2} ${H / 2}) scale(${scale}) translate(${-cx} ${-cy})`;
  }, [view]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="geo-map-fast h-full w-full touch-none select-none"
      role="img"
      aria-label="Place map"
      onPointerDown={(event) => {
        if (!interactive) return;
        (event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY, lng: view.lng, lat: view.lat };
      }}
      onPointerMove={(event) => {
        if (!drag.current || !interactive) return;
        const scale = Math.pow(2, view.zoom) * (W / 360);
        const dx = event.clientX - drag.current.x;
        const dy = event.clientY - drag.current.y;
        onViewChange({
          ...view,
          lng: drag.current.lng - dx / scale,
          lat: drag.current.lat + dy / scale,
        });
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onWheel={(event) => {
        if (!interactive) return;
        event.preventDefault();
        const delta = event.deltaY > 0 ? -0.35 : 0.35;
        onViewChange({ ...view, zoom: Math.min(6, Math.max(-1, view.zoom + delta)) });
      }}
    >
      <rect width={W} height={H} className="geo-map-fast-bg" />
      <g transform={landTransform}>
        {WORLD_LAND_PATHS.map((d, index) => (
          <path key={index} d={d} className="geo-map-fast-land" vectorEffect="non-scaling-stroke" />
        ))}
      </g>
      {grid.map((line) => (
        <line
          key={line.key}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          className="geo-map-fast-grid"
          strokeWidth={0.6}
        />
      ))}
      {dots.map(({ marker, x, y }) => {
        const active = marker.id === focusId;
        const color = KIND_COLOR[marker.kind];
        const r = active ? 8 : 6;
        return (
          <g key={marker.id}>
            <circle
              cx={x}
              cy={y}
              r={r + 2}
              fill="transparent"
              className={interactive ? "cursor-pointer" : undefined}
              onClick={() => onSelect?.(marker.name, marker)}
            />
            <circle
              cx={x}
              cy={y}
              r={r}
              fill={color}
              stroke={active ? "#0f172a" : color}
              strokeWidth={active ? 2 : 0}
              pointerEvents="none"
            />
            {marker.count && marker.count > 1 ? (
              <text
                x={x}
                y={y - r - 2}
                textAnchor="middle"
                fontSize={9}
                fontWeight={600}
                className="geo-map-fast-count"
                pointerEvents="none"
              >
                {marker.count}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
