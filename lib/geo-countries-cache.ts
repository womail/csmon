import type { FeatureCollection } from "geojson";

let cache: FeatureCollection | null = null;
let pending: Promise<FeatureCollection | null> | null = null;

/** One shared fetch for Natural Earth countries (vector fallback maps). */
export function loadCountriesGeoJson(): Promise<FeatureCollection | null> {
  if (cache) return Promise.resolve(cache);
  if (pending) return pending;
  pending = fetch("/geo/countries.geojson")
    .then((res) => (res.ok ? res.json() : null))
    .then((data: FeatureCollection | null) => {
      cache = data;
      return data;
    })
    .catch(() => null)
    .finally(() => {
      pending = null;
    });
  return pending;
}
