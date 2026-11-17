import { NextResponse } from "next/server";
import { APP_BUILD_COMMIT } from "@/lib/build-info";
import { APP_NAME, APP_VERSION } from "@/lib/version";
import { tokenRequired } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      name: APP_NAME,
      version: APP_VERSION,
      commit: APP_BUILD_COMMIT,
      auth: tokenRequired(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
