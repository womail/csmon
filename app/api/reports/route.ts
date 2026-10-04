import { fail, gate, jsonOk, readJson } from "@/lib/guard";
import { listStoredReports, replaceStoredReports, storedReportCount } from "@/lib/reports-store";
import type { Report } from "@/lib/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isReport(value: unknown): value is Report {
  if (!value || typeof value !== "object") return false;
  const row = value as Report;
  return typeof row.id === "string" && typeof row.title === "string" && Array.isArray(row.stories);
}

export function GET(request: Request) {
  const blocked = gate(request, "reports", 40);
  if (blocked) return blocked;
  return jsonOk({ reports: listStoredReports(), count: storedReportCount() });
}

export async function POST(request: Request) {
  const blocked = gate(request, "reports-write", 20);
  if (blocked) return blocked;
  try {
    const body = await readJson<{ reports?: unknown }>(request, 2_000_000);
    const rows = Array.isArray(body.reports) ? body.reports.filter(isReport) : [];
    return jsonOk({ reports: replaceStoredReports(rows) });
  } catch (error) {
    return fail(error, "Could not save reports");
  }
}
