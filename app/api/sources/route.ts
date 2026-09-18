import { NextResponse } from "next/server";
import { deleteSource, getMonitorState, setSourceEnabled } from "@/lib/queries";
import { refreshSources } from "@/lib/scrape/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      enable?: number[];
      disable?: number[];
    };
    if (body.disable?.length) setSourceEnabled(body.disable, false);
    if (body.enable?.length) {
      setSourceEnabled(body.enable, true);
      await refreshSources(body.enable);
    }
    return NextResponse.json(getMonitorState());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  deleteSource(id);
  return NextResponse.json(getMonitorState());
}
