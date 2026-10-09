"use client";

import { useMemo, useRef } from "react";
import { KIND_COLOR } from "@/components/monitor/map-colors";
import {
  FAST_MAP_H,
  FAST_MAP_MAX_ZOOM,
  FAST_MAP_MIN_ZOOM,
  FAST_MAP_W,
  landTransform,
  project,
  type FastMapView,
} from "@/lib/fast-map-projection";
import type { MapMarker } from "@/lib/geo";
import { WORLD_LAND_PATHS } from "@/lib/world-land-paths";

export type { FastMapView };

export function fitFastMapView(
  markers: MapMarker[],
  anchor?: { lat: number; lng: number } | null,
): FastMapView {
  const pts = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
  if (!pts.length) {
    if (anchor && Number.isFinite(anchor.lat) && Number.isFinite(anchor.lng)) {
      return { lat: anchor.lat, lng: anchor.lng, zoom: 2.5 };
    }
    return { lat: 22, lng: 10, zoom: 0 };
  }
  const lats = pts.map((m) => m.lat);
  const lngs = pts.map((m) => m.lng);
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const lngMin = Math.min(...lngs);
  const lngMax = Math.max(...lngs);
  const latSpan = Math.max(4, latMax - latMin);
  const lngSpan = Math.max(6, lngMax - lngMin);
  const span = Math.max(latSpan, lngSpan * 0.55);
  const zoom = Math.min(FAST_MAP_MAX_ZOOM - 1, Math.max(FAST_MAP_MIN_ZOOM, 3.2 - Math.log2(span / 28)));
  return {
    lat: (latMin + latMax) / 2,
    lng: (lngMin + lngMax) / 2,
    zoom,
  };
}

const PLANE_PATH =
  "M12 1.4 14 11.2 22 14.2 13.8 14.6 13 22.2 12 20.2 11 22.2 10.2 14.6 2 14.2 10 11.2Z";

export function FastPlaceMap({
  markers,
  focusId,
  view,
  onViewChange,
  onSelect,
  interactive,
  anchor,
}: {
  markers: MapMarker[];
  focusId?: string | null;
  view: FastMapView;
  onViewChange: (view: FastMapView) => void;
  onSelect?: (name: string, marker?: MapMarker) => void;
  interactive?: boolean;
  anchor?: { lat: number; lng: number } | null;
}) {
  const drag = useRef<{ x: number; y: number; lng: number; lat: number } | null>(null);

  const grid = useMemo(() => {
    const step = view.zoom >= 4 ? 10 : view.zoom >= 2 ? 15 : 30;
    const lines: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];
    for (let lat = -60; lat <= 60; lat += step) {
      const a = project(lat, -180, view);
      const b = project(lat, 180, view);
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, key: `lat-${lat}` });
    }
    for (let lng = -150; lng <= 150; lng += step) {
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

  const anchorPt = useMemo(() => {
    if (!anchor || !Number.isFinite(anchor.lat) || !Number.isFinite(anchor.lng)) return null;
    return project(anchor.lat, anchor.lng, view);
  }, [anchor, view]);

  const transform = useMemo(() => landTransform(view), [view]);

  const panScale = Math.pow(2, view.zoom) * (FAST_MAP_W / 360);

  return (
    <svg
      viewBox={`0 0 ${FAST_MAP_W} ${FAST_MAP_H}`}
      className="geo-map-fast h-full w-full touch-none select-none"
      shapeRendering="geometricPrecision"
      role="img"
      aria-label="Place map"
      onPointerDown={(event) => {
        if (!interactive) return;
        (event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY, lng: view.lng, lat: view.lat };
      }}
      onPointerMove={(event) => {
        if (!drag.current || !interactive) return;
        const dx = event.clientX - drag.current.x;
        const dy = event.clientY - drag.current.y;
        onViewChange({
          ...view,
          lng: drag.current.lng - dx / panScale,
          lat: drag.current.lat + dy / panScale,
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
        onViewChange({
          ...view,
          zoom: Math.min(FAST_MAP_MAX_ZOOM, Math.max(FAST_MAP_MIN_ZOOM, view.zoom + delta)),
        });
      }}
    >
      <rect width={FAST_MAP_W} height={FAST_MAP_H} className="geo-map-fast-bg" />
      <g transform={transform}>
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
          strokeWidth={0.5}
        />
      ))}
      {anchorPt ? (
        <g pointerEvents="none">
          <circle
            cx={anchorPt.x}
            cy={anchorPt.y}
            r={28}
            className="geo-map-fast-anchor-ring"
            strokeWidth={1}
          />
          <circle cx={anchorPt.x} cy={anchorPt.y} r={4} className="geo-map-fast-anchor" />
        </g>
      ) : null}
      {dots.map(({ marker, x, y }) => {
        const active = marker.id === focusId;
        const color = KIND_COLOR[marker.kind];
        const r = active ? 8 : 6;
        if (marker.kind === "flight") {
          const deg = Number.isFinite(marker.heading) ? Number(marker.heading) : 0;
          const size = active ? 20 : 16;
          return (
            <g key={marker.id}>
              <circle
                cx={x}
                cy={y}
                r={size / 2 + 4}
                fill="transparent"
                className={interactive ? "cursor-pointer" : undefined}
                onClick={() => onSelect?.(marker.name, marker)}
              />
              <g
                transform={`translate(${x} ${y}) rotate(${deg})`}
                pointerEvents="none"
                className={active ? "geo-map-fast-plane is-active" : "geo-map-fast-plane"}
              >
                <path
                  d={PLANE_PATH}
                  transform={`translate(${-12} ${-12}) scale(${size / 24})`}
                  fill={color}
                  stroke={active ? "#0f172a" : "none"}
                  strokeWidth={active ? 1.5 : 0}
                />
              </g>
            </g>
          );
        }
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
