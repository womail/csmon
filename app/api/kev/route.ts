import { NextResponse } from "next/server";
import { fetchKevCatalog } from "@/lib/kev-fetch";
import { getMonitorState, replaceKev } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const entries = await fetchKevCatalog();
    replaceKev(entries);
    return NextResponse.json(getMonitorState());
  } catch (error) {
    const message = error instanceof Error ? error.message : "KEV fetch failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
