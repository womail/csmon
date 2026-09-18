import { NextResponse } from "next/server";
import { getMonitorState } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getMonitorState());
}
