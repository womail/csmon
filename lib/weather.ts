export type WeatherEvent = {
  id: string;
  title: string;
  severity: string;
  place: string;
  lat: number | null;
  lng: number | null;
  time: number;
  url: string;
  source: "nws" | "local" | "met";
  hint?: string;
};

export type LocalWeather = {
  place: string;
  lat: number;
  lng: number;
  temperature: number | null;
  wind: number | null;
  precipitation: number | null;
  code: number | null;
  summary: string;
};

const WMO: Record<number, string> = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  61: "Rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm",
  99: "Thunderstorm",
};

export function weatherSummary(code: number | null) {
  if (code == null) return "Local conditions";
  return WMO[code] ?? `Weather code ${code}`;
}
