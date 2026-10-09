#!/usr/bin/env node
/**
 * Build lib/world-land-paths.ts from Natural Earth admin GeoJSON (Web Mercator @ 1024×512).
 * Usage: node scripts/build-world-land-paths.mjs [path-to.geojson]
 */
import fs from "node:fs";
import path from "node:path";

const W = 1024;
const H = 512;
const MERC_MAX = 85.05112878;

function mercatorY(lat) {
  const clamped = Math.max(-MERC_MAX, Math.min(MERC_MAX, lat));
  const rad = (clamped * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(Math.PI / 4 + rad / 2)) / Math.PI) / 2) * H;
}

function project(lng, lat) {
  const x = ((lng + 180) / 360) * W;
  const y = mercatorY(lat);
  return [x, y];
}

function dist2(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

/** Drop points closer than minDist (px) — keeps files small, preserves coast detail. */
function simplifyRing(ring, minDist = 0.65) {
  if (ring.length < 3) return ring;
  const minD2 = minDist * minDist;
  const out = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    const p = ring[i];
    if (dist2(p, out[out.length - 1]) >= minD2) out.push(p);
  }
  if (out.length >= 3 && dist2(out[0], out[out.length - 1]) < minD2) out.pop();
  return out;
}

function ringToPath(ring) {
  if (ring.length < 2) return null;
  const pts = ring.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`);
  return `M${pts[0]}L${pts.slice(1).join("L")}Z`;
}

function pathsFromGeometry(geom, minDist) {
  const paths = [];
  const pushRing = (ring) => {
    if (!ring?.length) return;
    const projected = ring.map(([lng, lat]) => project(lng, lat));
    const simplified = simplifyRing(projected, minDist);
    const d = ringToPath(simplified);
    if (d) paths.push(d);
  };

  if (geom.type === "Polygon") {
    for (const ring of geom.coordinates) pushRing(ring);
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) {
      for (const ring of poly) pushRing(ring);
    }
  }
  return paths;
}

const root = path.resolve(import.meta.dirname, "..");
const input =
  process.argv[2] ||
  (fs.existsSync(path.join(root, "public/geo/countries-50m.geojson"))
    ? path.join(root, "public/geo/countries-50m.geojson")
    : path.join(root, "public/geo/countries.geojson"));

const geo = JSON.parse(fs.readFileSync(input, "utf8"));
const minDist = input.includes("50m") ? 0.72 : 0.55;
const paths = [];

for (const feature of geo.features ?? []) {
  if (!feature.geometry) continue;
  paths.push(...pathsFromGeometry(feature.geometry, minDist));
}

const outPath = path.join(root, "lib/world-land-paths.ts");
const header = `// Auto from ${path.basename(input)} @ ${W}×${H} Web Mercator — rebuild: node scripts/build-world-land-paths.mjs\n`;
const body = `export const WORLD_LAND_PATHS: string[] = [\n${paths.map((d) => `  ${JSON.stringify(d)},`).join("\n")}\n];\n`;

fs.writeFileSync(outPath, header + body);
console.log(`Wrote ${paths.length} paths (${(Buffer.byteLength(body) / 1024).toFixed(1)} KB) → ${outPath}`);
