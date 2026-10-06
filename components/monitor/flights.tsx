"use client";

import { ExternalLink, Plane } from "lucide-react";
import dynamic from "next/dynamic";

const FlightMap = dynamic(
  () => import("@/components/monitor/flight-map").then((mod) => ({ default: mod.FlightMap })),
  { ssr: false, loading: () => <div className="geo-map-skeleton min-h-[420px]">Loading map…</div> },
);
import { Tip } from "@/components/monitor/tip";
import { Button } from "@/components/ui/button";
import { aircraftLinks, flightLabel, type AircraftProfile, type Flight } from "@/lib/flights";
import { HOME_CITIES, type GeoPoint, type MapMarker } from "@/lib/geo";

export function FlightDesk({
  flights,
  selected,
  profile,
  error,
  onSelect,
  onRefresh,
  busy,
  home,
  radiusKm,
  onHomeChange,
}: {
  flights: Flight[];
  selected: Flight | null;
  profile: AircraftProfile | null;
  error: string | null;
  onSelect: (flight: Flight) => void;
  onRefresh: () => void;
  busy: boolean;
  home: GeoPoint | null;
  radiusKm: number;
  onHomeChange: (name: string) => void;
}) {
  const markers: MapMarker[] = flights
    .filter((flight) => Number.isFinite(flight.lat) && Number.isFinite(flight.lng))
    .map((flight) => ({
      id: flight.icao24,
      name: flightLabel(flight),
      lat: flight.lat,
      lng: flight.lng,
      kind: "flight" as const,
      heading: flight.heading,
      hint: `${flight.country} · ${flight.altitude != null ? `${Math.round(flight.altitude)} m` : "airborne"}`,
    }));

  return (
    <div className="flex h-[calc(100vh-7.25rem)] min-h-[540px] flex-col bg-white lg:flex-row">
      <div className="min-h-[420px] min-w-0 flex-1">
        <FlightMap
          markers={markers}
          focusId={selected?.icao24 ?? null}
          anchor={home}
          onSelect={(_name, marker) => {
            if (!marker) return;
            const hit = flights.find((flight) => flight.icao24 === marker.id);
            if (hit) onSelect(hit);
          }}
        />
      </div>
      <div className="flex w-full shrink-0 flex-col border-t border-slate-200 bg-white lg:w-[300px] lg:border-t-0 lg:border-l">
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
              Live ADS-B
            </div>
            <p className="mt-1 text-[12px] text-slate-600">
              {home
                ? `${flights.length} airborne within ${radiusKm} km of ${home.name}`
                : "Pick a home location to keep nearby tracks, including Dublin."}
            </p>
            <label className="mt-2 block text-[11px] text-slate-500">
              Home location
              <select
                className="mt-1 h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] text-slate-800"
                value={home?.name ?? ""}
                onChange={(event) => onHomeChange(event.target.value)}
              >
                <option value="">World sample</option>
                {HOME_CITIES.map((city) => (
                  <option key={city.name} value={city.name}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Tip text="Refresh the public ADS-B snapshot">
            <Button size="xs" variant="outline" onClick={onRefresh} disabled={busy}>
              <Plane className="size-3" />
              {busy ? "Loading" : "Refresh"}
            </Button>
          </Tip>
        </div>
        {error ? <p className="px-3 pt-2 text-[12px] text-rose-600">{error}</p> : null}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {flights.slice(0, 120).map((flight) => (
            <button
              key={flight.icao24}
              type="button"
              onClick={() => onSelect(flight)}
              className={`w-full border-b border-slate-50 px-3 py-2 text-left hover:bg-slate-50 ${
                selected?.icao24 === flight.icao24 ? "bg-slate-100" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[12px] font-semibold text-slate-800">
                  {flightLabel(flight)}
                </span>
                <span className="text-[10px] text-slate-400">{flight.country}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {flight.altitude != null ? `${Math.round(flight.altitude)} m` : "alt n/a"}
                {flight.speed != null ? ` · ${Math.round(flight.speed)} m/s` : ""}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AircraftPane({
  flight,
  profile,
  onClose,
}: {
  flight: Flight;
  profile: AircraftProfile | null;
  onClose: () => void;
}) {
  const links = aircraftLinks(flight, profile);
  return (
    <aside className="flex h-full min-h-[70vh] flex-col border-l border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div>
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Aircraft
          </div>
          <div className="font-mono text-[15px] font-semibold text-slate-900">{flightLabel(flight)}</div>
          <div className="text-[11px] text-slate-500">{flight.icao24.toUpperCase()}</div>
        </div>
        <button type="button" onClick={onClose} className="text-[11px] text-slate-500">
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3 text-[12px]">
        <p>
          <span className="text-slate-400">Country · </span>
          {flight.country || "Unknown"}
        </p>
        <p>
          <span className="text-slate-400">Position · </span>
          {Number.isFinite(flight.lat) ? `${flight.lat.toFixed(3)}, ${flight.lng.toFixed(3)}` : "n/a"}
        </p>
        <p>
          <span className="text-slate-400">Altitude · </span>
          {flight.altitude != null ? `${Math.round(flight.altitude)} m` : "n/a"}
        </p>
        <p>
          <span className="text-slate-400">Speed · </span>
          {flight.speed != null ? `${Math.round(flight.speed)} m/s` : "n/a"}
        </p>
        <p>
          <span className="text-slate-400">Heading · </span>
          {flight.heading != null ? `${Math.round(flight.heading)}°` : "n/a"}
        </p>
        {profile ? (
          <>
            <p>
              <span className="text-slate-400">Registration · </span>
              {profile.registration ?? "n/a"}
            </p>
            <p>
              <span className="text-slate-400">Type · </span>
              {[profile.manufacturer, profile.type].filter(Boolean).join(" ") || "n/a"}
            </p>
            <p>
              <span className="text-slate-400">Operator · </span>
              {profile.operator ?? "n/a"}
            </p>
          </>
        ) : (
          <p className="text-slate-400">Looking up the airframe…</p>
        )}
        <div className="pt-2">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Open elsewhere
          </div>
          <div className="mt-1 flex flex-col gap-1">
            {links.map((link) => (
              <Tip key={link.href} text={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-slate-700 hover:underline"
                >
                  <ExternalLink className="size-3" />
                  {link.label}
                </a>
              </Tip>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
