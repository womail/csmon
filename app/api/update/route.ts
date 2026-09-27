import { fail, gate, jsonOk } from "@/lib/guard";
import {
  fetchUpdateManifest,
  isVersionNewer,
  normalizeTag,
  resolveManifestUrl,
  type UpdateCheckPayload,
} from "@/lib/update-manifest";
import { APP_NAME, APP_VERSION, DEFAULT_UPDATE_REPO } from "@/lib/version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GithubRelease = {
  tag_name?: string;
  html_url?: string;
  name?: string;
  published_at?: string;
  body?: string;
};

const APPLY_HINT =
  "Run scripts/update.sh (git) or scripts/update.sh docker on the host. The API never applies updates.";

async function checkGithub(repo: string): Promise<UpdateCheckPayload> {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `${APP_NAME}/${APP_VERSION}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) {
    return {
      name: APP_NAME,
      current: APP_VERSION,
      latest: null,
      newer: false,
      repo: `https://github.com/${repo}`,
      releaseUrl: null,
      source: "github",
      notes: "No GitHub releases yet. Use scripts/update.sh to pull and rebuild.",
      apply: APPLY_HINT,
    };
  }
  if (!res.ok) throw new Error("update check failed");
  const data = (await res.json()) as GithubRelease;
  const latest = normalizeTag(data.tag_name || data.name || "");
  return {
    name: APP_NAME,
    current: APP_VERSION,
    latest: latest || null,
    newer: latest ? isVersionNewer(APP_VERSION, latest) : false,
    repo: `https://github.com/${repo}`,
    releaseUrl: data.html_url ?? null,
    publishedAt: data.published_at ?? null,
    source: "github",
    notes: (data.body ?? "").slice(0, 4000),
    apply: APPLY_HINT,
  };
}

/** Compare running version to manifest and/or GitHub (check-only). */
export async function GET(request: Request) {
  const blocked = gate(request, "update", 10);
  if (blocked) return blocked;
  const repo = (process.env.CSMON_UPDATE_REPO?.trim() || DEFAULT_UPDATE_REPO).replace(/^\/|\/$/g, "");
  const manifestUrl = resolveManifestUrl(request);

  try {
    if (manifestUrl) {
      const manifest = await fetchUpdateManifest(manifestUrl);
      const latest = normalizeTag(manifest.version);
      return jsonOk({
        name: APP_NAME,
        current: APP_VERSION,
        latest: latest || null,
        newer: latest ? isVersionNewer(APP_VERSION, latest) : false,
        repo: manifest.releaseUrl ? null : `https://github.com/${repo}`,
        releaseUrl: manifest.releaseUrl ?? null,
        publishedAt: manifest.publishedAt ?? null,
        commit: manifest.commit ?? null,
        source: "manifest",
        manifestUrl,
        notes: manifest.releaseNotes?.slice(0, 4000),
        apply: manifest.apply ?? APPLY_HINT,
        docker: manifest.docker ?? null,
      });
    }
    return jsonOk(await checkGithub(repo));
  } catch (error) {
    return fail(error, "Could not check for updates.");
  }
}
