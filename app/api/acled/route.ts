import { acledConfigured, normalizeAcledProfiles } from "@/lib/acled";
import { fail, gate, jsonOk, readJson } from "@/lib/guard";
import { monitorStateFromRequest } from "@/lib/monitor-state";
import { registerAcledProfiles } from "@/lib/queries";
import { loadAcledProbe, runAcledProbe } from "@/lib/scrape/acled-probe";
import { refreshSources } from "@/lib/scrape/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** OAuth + read probe (diagnose 403 / missing API access). */
export async function GET(request: Request) {
  const blocked = gate(request, "acled", 12);
  if (blocked) return blocked;
  try {
    if (!acledConfigured()) {
      return jsonOk({
        configured: false,
        error: "Set ACLED_USERNAME and ACLED_PASSWORD in .env.local, then restart.",
      });
    }
    const probe = await runAcledProbe();
    return jsonOk({ configured: true, probe });
  } catch (error) {
    return fail(error, "ACLED probe failed");
  }
}

export async function POST(request: Request) {
  const blocked = gate(request, "acled", 6);
  if (blocked) return blocked;
  try {
    if (!acledConfigured()) {
      return jsonOk(
        {
          error:
            "ACLED is not configured. Add ACLED_USERNAME and ACLED_PASSWORD from myACLED to .env.local, restart the server, then Load again.",
        },
        503,
      );
    }
    const body = await readJson<{ profiles?: unknown }>(request);
    if (!Array.isArray(body.profiles)) return jsonOk({ error: "Send a list of ACLED profiles." }, 400);
    const profiles = normalizeAcledProfiles(body.profiles);
    const ids = registerAcledProfiles(profiles);
    if (!ids.length) {
      return jsonOk({ error: "Enable at least one ACLED profile." }, 400);
    }
    const result = await refreshSources(ids, { bustCache: true });
    const probe = await runAcledProbe().catch(() => loadAcledProbe());
    if (result.failed > 0 && result.ok === 0) {
      return jsonOk(
        {
          error: result.errors[0] ?? "ACLED fetch failed.",
          acledRefresh: { ok: result.ok, failed: result.failed, errors: result.errors },
          probe,
          ...monitorStateFromRequest(request),
        },
        502,
      );
    }
    return jsonOk({
      ...monitorStateFromRequest(request),
      acledRefresh: { ok: result.ok, failed: result.failed, errors: result.errors },
      probe,
    });
  } catch (error) {
    return fail(error, "ACLED load failed");
  }
}
