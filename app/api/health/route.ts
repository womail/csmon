import { NextResponse } from "next/server";
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
      auth: tokenRequired(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
