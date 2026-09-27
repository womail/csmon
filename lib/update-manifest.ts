/** Optional static JSON manifest for private / self-hosted update checks (see public/csmon-update.example.json). */

import { APP_NAME, APP_VERSION } from "./version";

export type UpdateManifest = {
  schema?: string;
  name?: string;
  version: string;
  publishedAt?: string;
  commit?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  /** Human steps; never executed by the app. */
  apply?: string;
  docker?: { image?: string; composeHint?: string };
};

export type UpdateCheckPayload = {
  name: string;
  current: string;
  latest: string | null;
  newer: boolean;
  repo: string | null;
  releaseUrl: string | null;
  publishedAt?: string | null;
  commit?: string | null;
  notes?: string;
  apply?: string;
  source: "manifest" | "github" | "none";
  manifestUrl?: string | null;
  error?: string;
};

export function normalizeTag(tag: string) {
  return tag.replace(/^v/i, "").trim();
}

export function isVersionNewer(current: string, latest: string) {
  const a = current.split(".").map((n) => Number(n) || 0);
  const b = latest.split(".").map((n) => Number(n) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (right > left) return true;
    if (right < left) return false;
  }
  return false;
}

export function parseUpdateManifest(body: unknown): UpdateManifest | null {
  if (!body || typeof body !== "object") return null;
  const row = body as UpdateManifest;
  if (!row.version?.trim()) return null;
  return row;
}

/** Resolve manifest URL: env default, or client param when hostname matches allow suffix. */
export function resolveManifestUrl(request: Request): string | null {
  const envUrl = process.env.CSMON_UPDATE_MANIFEST_URL?.trim();
  const suffix = process.env.CSMON_UPDATE_MANIFEST_ALLOW_SUFFIX?.trim();
  const param = new URL(request.url).searchParams.get("manifestUrl")?.trim();
  if (param) {
    try {
      const host = new URL(param).hostname.toLowerCase();
      if (suffix) {
        const needle = suffix.startsWith(".") ? suffix.slice(1) : suffix;
        if (host === needle || host.endsWith(`.${needle}`)) return param;
      }
    } catch {
      return envUrl ?? null;
    }
    return envUrl ?? null;
  }
  return envUrl ?? null;
}

export async function fetchUpdateManifest(url: string): Promise<UpdateManifest> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": `${APP_NAME}/${APP_VERSION}` },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
  const data = parseUpdateManifest(await res.json());
  if (!data) throw new Error("invalid manifest JSON");
  return data;
}
