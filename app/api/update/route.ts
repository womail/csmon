import { fail, gate, jsonOk } from "@/lib/guard";
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

function normalizeTag(tag: string) {
  return tag.replace(/^v/i, "").trim();
}

function isNewer(current: string, latest: string) {
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

export async function GET(request: Request) {
  const blocked = gate(request, "update", 10);
  if (blocked) return blocked;
  const repo = (process.env.CSMON_UPDATE_REPO?.trim() || DEFAULT_UPDATE_REPO).replace(/^\/|\/$/g, "");
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `${APP_NAME}/${APP_VERSION}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 404) {
      return jsonOk({
        name: APP_NAME,
        current: APP_VERSION,
        latest: null,
        newer: false,
        repo: `https://github.com/${repo}`,
        releaseUrl: null,
        notes: "No GitHub releases yet. Use scripts/update.sh to pull and rebuild.",
        apply: "Run scripts/update.sh (git) or scripts/update.sh docker. The API never applies updates.",
      });
    }
    if (!res.ok) throw new Error("update check failed");
    const data = (await res.json()) as GithubRelease;
    const latest = normalizeTag(data.tag_name || data.name || "");
    return jsonOk({
      name: APP_NAME,
      current: APP_VERSION,
      latest: latest || null,
      newer: latest ? isNewer(APP_VERSION, latest) : false,
      repo: `https://github.com/${repo}`,
      releaseUrl: data.html_url ?? null,
      publishedAt: data.published_at ?? null,
      notes: (data.body ?? "").slice(0, 4000),
      apply: "Run scripts/update.sh (git) or scripts/update.sh docker. The API never applies updates.",
    });
  } catch (error) {
    return fail(error, "Could not check for updates.");
  }
}
