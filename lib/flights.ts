export type Flight = {
  icao24: string;
  callsign: string;
  country: string;
  lat: number;
  lng: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  onGround: boolean;
};

export type AircraftProfile = {
  icao24: string;
  registration: string | null;
  type: string | null;
  manufacturer: string | null;
  operator: string | null;
  owner: string | null;
  icaoType: string | null;
};

export function flightLabel(flight: Flight) {
  return flight.callsign || flight.icao24.toUpperCase();
}

export function aircraftLinks(flight: Flight, profile?: AircraftProfile | null) {
  const hex = flight.icao24.toLowerCase();
  const call = encodeURIComponent(flight.callsign || hex);
  const reg = profile?.registration ? encodeURIComponent(profile.registration) : "";
  return [
    {
      label: "ADS-B Exchange globe",
      href: `https://globe.adsbexchange.com/?icao=${hex}`,
    },
    {
      label: "FlightAware",
      href: `https://www.flightaware.com/live/flight/${call}`,
    },
    {
      label: "OpenSky",
      href: `https://opensky-network.org/aircraft-profile?icao24=${hex}`,
    },
    ...(reg
      ? [{ label: "Registration search", href: `https://www.flightradar24.com/data/aircraft/${reg.toLowerCase()}` }]
      : []),
  ];
}
